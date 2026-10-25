import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionEncounterChangeFacingCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { admitsEncounterFacing } from '@artificer-toolkit/rules-runtime/encounterFacing'
import { readChangeFacingAdmission } from './basicActionAdmission.js'
import { readRunActors, replaceRunActor } from './documents.js'
import { rejectDomain } from './domainRejections.js'
import { activationAllowanceMatches } from './escapeEffectVerification.js'
import { projectNativeGm } from './nativeProjection.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import type { EncounterWriteTransaction } from './ports.js'

const CHANGE_FACING_LABEL = 'Change facing'

/**
 * Records the room's planned Change facing reaction (ATTACK-12): the reaction it spent and the Scene
 * command that turned the actor's token, which the room writes through `setActorFacing` in the same
 * commit. The Facing rule and the reaction are re-checked here; the room's plan is trusted only for
 * the warnings it acknowledged. Turning is not movement, so no speed is spent.
 */
export async function persistEncounterChangeFacing(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterChangeFacingCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      actors: readonly EncounterRunActorState[],
      input: LiveSessionEncounterChangeFacingCommitInput
    ): Promise<void>
    setActorFacing(change: {
      encounterId: string
      commandId: string
      actorId: string
      rotationDegrees: number
    }): Promise<{ sceneId: string; tokenId: string; sceneCommandId: string }>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readChangeFacingAdmission(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, command, fingerprint } = admission
  if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
    throw new Error('Live Session facing-change overrides were not acknowledged.')
  const actors = await readRunActors(ctx, state)
  await callbacks.validateReadFence(state, actors, input)
  const actor = actors.find((entry) => entry.id === command.actorId)
  const ruleActors = actors.filter((entry) => entry.kind !== 'CHARACTER')
  if (
    !actor ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((entry) => !ruleActors.some((rule) => rule.id === entry.actorId))
  )
    throw new Error('Live Session facing-change scope mismatch.')
  if (!admitsEncounterFacing(state, command.rotationDegrees)) rejectDomain('FACING_UNAVAILABLE')
  if (!activationAllowanceMatches(state, { code: 'REACTION', amount: 1 }, input.actionEconomy))
    throw new Error('Live Session facing change differs from its reaction.')
  const spent = input.actionEconomy
    ? consumeEncounterActionEconomy({
        actor,
        consumption: input.actionEconomy,
        overridden: overridesActionEconomy(input.ruleOverrides)
      })
    : actor
  await replaceRunActor(ctx, actor, spent)
  const turned = await callbacks.setActorFacing({
    encounterId: run.id,
    commandId: command.commandId,
    actorId: actor.id,
    rotationDegrees: command.rotationDegrees
  })
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
      commandType: 'CHANGE_FACING',
      label: CHANGE_FACING_LABEL,
      ruleOverrides: input.ruleOverrides,
      receipt: { actorId: actor.id, actionEconomy: input.actionEconomy, ...turned },
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
