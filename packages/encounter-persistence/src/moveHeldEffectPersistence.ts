import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionEncounterMoveHeldEffectCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { resolveEffectOffer } from '@artificer-toolkit/rules-runtime/encounterEffectOffers'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { readMoveHeldEffectAdmission } from './basicActionAdmission.js'
import { readEncounterActorDefeated, readZeroHitPointActorIds } from './characterStates.js'
import { readRunActors, replaceRunActor } from './documents.js'
import { createActiveRuleEffectStore, readActiveEffectsByActorId } from './effectStore.js'
import { activationAllowanceMatches } from './escapeEffectVerification.js'
import { projectNativeGm } from './nativeProjection.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import type { EncounterWriteTransaction } from './ports.js'

const MOVE_HELD_EFFECT_LABEL = 'Move effect'
const MOVE_HELD_EFFECT_MISMATCH = 'Live Session effect move differs from the effect offer.'

/**
 * Records the room's planned move of a held effect (D160): the offer's activation it spent, and the
 * effect re-created under its new holder with the same id, definition, lifecycle and maintained
 * state, so its remaining duration and Concentration link carry over. The offer is re-derived here
 * from the stored effect and the Run's hit points; the room's plan is trusted only for the economy
 * and the warnings it acknowledged. It evaluates no rules.
 */
export async function persistEncounterMoveHeldEffect(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterMoveHeldEffectCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      actors: readonly EncounterRunActorState[],
      input: LiveSessionEncounterMoveHeldEffectCommitInput
    ): Promise<void>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readMoveHeldEffectAdmission(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, command, fingerprint } = admission
  if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
    throw new Error('Live Session effect-move overrides were not acknowledged.')
  const actors = await readRunActors(ctx, state)
  await callbacks.validateReadFence(state, actors, input)
  const actor = actors.find((entry) => entry.id === command.actorId)
  const target = actors.find((entry) => entry.id === command.target.actorId)
  const ruleActors = actors.filter((entry) => entry.kind !== 'CHARACTER')
  if (
    !actor ||
    !target ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((entry) => !ruleActors.some((rule) => rule.id === entry.actorId))
  )
    throw new Error('Live Session effect-move scope mismatch.')
  const offer = resolveEffectOffer({
    actorId: actor.id,
    effectsByHolder: await readActiveEffectsByActorId(ctx, state.id, actors),
    zeroHitPointActorIds: await readZeroHitPointActorIds(ctx, actors),
    effectId: command.effectId,
    offerIndex: command.offerIndex,
    kind: 'MOVE_HELD_EFFECT'
  })
  if (
    offer.holderActorId === target.id ||
    (await readEncounterActorDefeated(ctx, target)) ||
    !activationAllowanceMatches(state, { code: offer.activation, amount: 1 }, input.actionEconomy)
  )
    throw new Error(MOVE_HELD_EFFECT_MISMATCH)
  const holder = actors.find((entry) => entry.id === offer.holderActorId)
  const store = createActiveRuleEffectStore(ctx)
  const holderOwner = holder && turnEffectOwner(holder, state.id)
  const before = holderOwner ? await store.findById(holderOwner, offer.effectId) : null
  if (!holderOwner || !before) throw new Error(MOVE_HELD_EFFECT_MISMATCH)
  const spent = input.actionEconomy
    ? consumeEncounterActionEconomy({
        actor,
        consumption: input.actionEconomy,
        overridden: overridesActionEconomy(input.ruleOverrides)
      })
    : actor
  await replaceRunActor(ctx, actor, spent)
  await store.deleteCas({
    id: before.id,
    owner: holderOwner,
    expectedVersion: before.version,
    removal: 'REMOVED'
  })
  const moved = await store.create({
    id: before.id,
    owner: turnEffectOwner(target, state.id),
    definition: before.definition,
    lifecycle: before.lifecycle,
    maintainedEffectStateId: before.maintainedEffectStateId,
    occurredAt: input.occurredAt
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
      commandType: 'MOVE_HELD_EFFECT',
      label: MOVE_HELD_EFFECT_LABEL,
      ruleOverrides: input.ruleOverrides,
      receipt: {
        actorId: actor.id,
        actionEconomy: input.actionEconomy,
        effectId: before.id,
        fromActorId: offer.holderActorId,
        toActorId: target.id,
        before,
        afterVersion: moved.version
      },
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
