import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterCharacterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { encounterActorRelationship } from '@artificer-toolkit/rules-runtime/encounterActionTargetPolicy'
import {
  defeatRewardMechanicsBatch,
  defeatTemporaryHitPoints
} from '@artificer-toolkit/rules-runtime/encounterDefeatReward'
import { liveSessionEncounterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { markMirroredRoot } from './roomDamageMirror.js'
import { defeatRewardLedger } from './roomDefeatRewardCollector.js'
import { applyRoomEncounterMechanicsBatch } from './roomEncounterMechanics.js'
import { roomLiveCaptureReads } from './roomLiveCaptureReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

/**
 * Gives each killer the temporary hit points its held defeat grants name (Dark One's Blessing), as
 * one post-settlement step of the command's transaction: after the root and its follow-ups have
 * settled, so the killer is read fresh. Only a defeat of a hostile creature counts; a killer that
 * holds no such grant, or has left the Encounter, gains nothing. Returns whether any reward landed,
 * so the caller re-reads what it projects.
 */
export async function settleDefeatRewards(input: {
  ctx: EncounterCharacterWriteTransaction
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  campaignId: string
  epoch: string
  userId: string
  observed: LiveSessionRulesRevisions
  encounterId: string
  random(maximum: number): number
}): Promise<boolean> {
  const { ctx, store, transaction, inputs, campaignId, epoch, userId, observed, encounterId } =
    input
  const state = defeatRewardLedger(transaction)
  const entries = state.entries.splice(0)
  if (entries.length === 0) return false
  const { membership } = await ctx.ports.requireCampaignAuthority(campaignId, userId)
  let landed = false
  for (const entry of entries) {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', encounterId))
      .unique()
    if (!run || run.status !== 'ACTIVE') return landed
    const runState = readRunState(run)
    if (!(await readRunActors(ctx, runState)).some((actor) => actor.id === entry.killerActorId))
      continue
    const scope = {
      campaignId,
      authorityEpoch: epoch,
      expectedUserId: userId,
      expectedRole: membership.role,
      encounterId,
      expectedVersion: run.version
    }
    const captures = roomLiveCaptureReads({ ctx, store, transaction, inputs, observed })
    const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
      state: runState,
      capture: (request) =>
        captures.encounterRules(liveSessionEncounterRulesInputSchema.parse({ ...scope, request }))
    })
    const killer = actors.find(({ id }) => id === entry.killerActorId)
    if (
      !killer ||
      encounterActorRelationship(killer.disposition, entry.defeatedDisposition) !== 'HOSTILE'
    )
      continue
    const { target } = await prepareNativeLiveMovementTarget({
      scope,
      state: runState,
      actor: killer,
      activeEffectsByActorId,
      captures,
      random: input.random
    })
    const amount = defeatTemporaryHitPoints(target.effectiveRulePolicyOutput?.modifierGroups ?? [])
    if (amount === 0) continue
    const { expectedCharacterStreamVersion: _stream, ...batch } = defeatRewardMechanicsBatch({
      state: runState,
      target,
      amount,
      ordinal: state.settledBatches,
      occurrenceId: entry.occurrenceId,
      rootCommandId: entry.rootCommandId,
      occurredAt: new Date().toISOString()
    })
    state.settledBatches += 1
    await applyRoomEncounterMechanicsBatch({
      ctx,
      store,
      transaction,
      inputs,
      campaignId,
      epoch,
      observed,
      batch
    })
    landed = true
  }
  if (landed) await markMirroredRoot(ctx, encounterId)
  return landed
}
