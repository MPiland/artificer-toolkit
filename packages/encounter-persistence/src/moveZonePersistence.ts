import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionEncounterMoveZoneCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { spatialGeometryCenteredAt } from '@artificer-toolkit/shared/vtt/spatial'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { sourceZoneMove } from '@artificer-toolkit/rules-runtime/encounterZoneMove'
import { readMoveZoneAdmission } from './basicActionAdmission.js'
import { readRunActors, replaceRunActor } from './documents.js'
import { activationAllowanceMatches } from './escapeEffectVerification.js'
import { projectNativeGm } from './nativeProjection.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'
import { insertRunCommand } from './timelineEntries.js'
import type { EncounterWriteTransaction } from './ports.js'

const MOVE_ZONE_LABEL = 'Move zone'
const MOVE_ZONE_MISMATCH = 'Live Session zone move differs from the zone.'

/**
 * Records the room's planned move of a maintained zone by its source (QUALITY-15.T3y8): the
 * activation it spent, and the zone centered on the destination. The zone is re-read at the version
 * the room measured from, and its source and authored move re-checked; the room's plan is trusted
 * only for the distance it measured on the Scene grid, the economy and the warnings it acknowledged.
 * It evaluates no rules: occupancy is read from the zone's geometry when a trigger next asks.
 */
export async function persistEncounterMoveZone(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterMoveZoneCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      actors: readonly EncounterRunActorState[],
      input: LiveSessionEncounterMoveZoneCommitInput
    ): Promise<void>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readMoveZoneAdmission(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, command, fingerprint } = admission
  if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
    throw new Error('Live Session zone-move overrides were not acknowledged.')
  const actors = await readRunActors(ctx, state)
  await callbacks.validateReadFence(state, actors, input)
  const actor = actors.find((entry) => entry.id === command.actorId)
  const ruleActors = actors.filter((entry) => entry.kind !== 'CHARACTER')
  if (
    !actor ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((entry) => !ruleActors.some((rule) => rule.id === entry.actorId))
  )
    throw new Error('Live Session zone-move scope mismatch.')
  const row = await ctx.db
    .query('encounterSpatialRuleEffects')
    .withIndex('by_publicId', (q) => q.eq('id', command.spatialEffectId))
    .unique()
  const store =
    row?.encounterId === state.id
      ? await createSpatialRuleEffectStore(ctx).scope({
          encounterId: row.encounterId,
          sceneId: row.sceneId
        })
      : null
  const zone = await store?.get(command.spatialEffectId)
  const move = zone && sourceZoneMove(zone, actor.id)
  if (
    !store ||
    !zone ||
    !move ||
    zone.version !== input.zoneVersion ||
    !activationAllowanceMatches(state, { code: move.activation, amount: 1 }, input.actionEconomy)
  )
    throw new Error(MOVE_ZONE_MISMATCH)
  const spent = input.actionEconomy
    ? consumeEncounterActionEconomy({
        actor,
        consumption: input.actionEconomy,
        overridden: overridesActionEconomy(input.ruleOverrides)
      })
    : actor
  await replaceRunActor(ctx, actor, spent)
  const before = zone.placement.geometry
  const moved = await store.updateCurrentStateCas({
    id: zone.id,
    expectedVersion: zone.version,
    lifecycle: zone.lifecycle,
    spatialState: zone.spatialState,
    placement: {
      ...zone.placement,
      geometry: { ...before, shape: spatialGeometryCenteredAt(before.shape, command.destination) }
    }
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
      commandType: 'MOVE_ZONE',
      label: MOVE_ZONE_LABEL,
      ruleOverrides: input.ruleOverrides,
      receipt: {
        actorId: actor.id,
        actionEconomy: input.actionEconomy,
        spatialEffectId: zone.id,
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
