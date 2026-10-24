import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionEncounterEndHeldGrantCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { revertActorForm } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { deleteGrants } from './consumedGrantPersistence.js'
import { readEndHeldGrantAdmission } from './basicActionAdmission.js'
import { readRunActors, replaceRunActor } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { activationAllowanceMatches } from './escapeEffectVerification.js'
import { projectNativeGm } from './nativeProjection.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import type { EncounterWriteTransaction } from './ports.js'

const END_HELD_GRANT_LABEL = 'End effect'
const END_HELD_GRANT_MISMATCH = "Live Session end-grant differs from the holder's effect."

/**
 * Records the room's planned end of a held grant (D113): the activation it spent, checked against
 * the current Run, and the grant's deletion. The grant's own stored `holderEnd` owns the activation;
 * the room's plan is never trusted for it. It evaluates no rules, and an ended grant is not
 * restored by an undo (D99).
 */
export async function persistEncounterEndHeldGrant(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterEndHeldGrantCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      actors: readonly EncounterRunActorState[],
      input: LiveSessionEncounterEndHeldGrantCommitInput
    ): Promise<void>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readEndHeldGrantAdmission(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, command, fingerprint } = admission
  if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
    throw new Error('Live Session end-grant overrides were not acknowledged.')
  const actors = await readRunActors(ctx, state)
  await callbacks.validateReadFence(state, actors, input)
  const actor = actors.find((entry) => entry.id === command.actorId)
  const ruleActors = actors.filter((entry) => entry.kind !== 'CHARACTER')
  if (
    !actor ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((entry) => !ruleActors.some((rule) => rule.id === entry.actorId))
  )
    throw new Error('Live Session end-grant scope mismatch.')
  const grant = await createActiveRuleEffectStore(ctx).findById(
    turnEffectOwner(actor, state.id),
    command.activeEffectId
  )
  const holderEnd = grant?.definition.recurrence.holderEnd
  if (!grant || !holderEnd || grant.maintainedEffectStateId !== null)
    throw new Error(END_HELD_GRANT_MISMATCH)
  if (
    !activationAllowanceMatches(
      state,
      { code: holderEnd.activation, amount: 1 },
      input.actionEconomy
    )
  )
    throw new Error(END_HELD_GRANT_MISMATCH)
  const paid = input.actionEconomy
    ? consumeEncounterActionEconomy({
        actor,
        consumption: input.actionEconomy,
        overridden: overridesActionEconomy(input.ruleOverrides)
      })
    : actor
  // Ending a form's own effect reverts its wearer (D130), as the plan's rules assumed.
  const spent = paid.form?.effectId === grant.id ? revertActorForm(paid) : paid
  await replaceRunActor(ctx, actor, spent)
  await deleteGrants(ctx, [grant])
  const nextActors = actors.map((entry) => (entry.id === spent.id ? spent : entry))
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection: await projectNativeGm(ctx, nextState, nextActors, input.rules),
    roll: null,
    occurrence: null
  })
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt: input.occurredAt
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: command.commandId,
      commandType: 'END_HELD_GRANT',
      label: END_HELD_GRANT_LABEL,
      ruleOverrides: input.ruleOverrides,
      receipt: { actorId: actor.id, actionEconomy: input.actionEconomy },
      commandFingerprint: fingerprint,
      actorUserId: input.expectedUserId,
      version: nextState.version,
      commandJson: JSON.stringify(command),
      ...encounterReplayReceipt(result),
      createdAt: input.occurredAt
    })
  )
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
