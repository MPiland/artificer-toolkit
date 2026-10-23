import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterCharacterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { damageMirrorMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterDamageMirror'
import { liveSessionEncounterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { damageMirrorLedger } from './roomDamageMirrorCollector.js'
import { applyRoomEncounterMechanicsBatch } from './roomEncounterMechanics.js'
import { roomLiveCaptureReads } from './roomLiveCaptureReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

/** Marks the Run's latest action root, so its undo is refused: it can't give a source its mirrored damage back. */
async function markMirroredRoot(ctx: EncounterCharacterWriteTransaction, encounterId: string) {
  const recent = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_encounterId_version', (query) => query.eq('encounterId', encounterId))
    .order('desc')
    .take(MIRRORED_ROOT_SCAN)
  const root = recent.find(({ commandType }) => commandType !== 'RESOLVE_RULE_OCCURRENCE')
  if (root?.commandType === 'RESOLVE_ACTION') await ctx.db.patch(root._id, { damageMirrored: true })
}

const MIRRORED_ROOT_SCAN = 16

/**
 * Applies the damage held mirrors passed on (Warding Bond) to their sources, as one post-settlement
 * step of the command's transaction: after the root and its follow-ups have settled the holder, so
 * every source is read fresh and nothing upstream keeps a stale copy of it. The source's own
 * defenses apply as for any damage; an absent source, or one no longer in the Encounter, takes
 * nothing. Returns whether any mirror landed, so the caller re-reads what it projects.
 */
export async function settleDamageMirrors(input: {
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
  const state = damageMirrorLedger(transaction)
  const entries = state.entries.splice(0)
  if (entries.length === 0) return false
  const readRun = () =>
    ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', encounterId))
      .unique()
  const { membership } = await ctx.ports.requireCampaignAuthority(campaignId, userId)
  const groups = new Map<string, typeof entries>()
  for (const entry of entries) {
    const key = `${entry.sourceActorId}|${entry.occurrenceId}|${entry.rootCommandId}`
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  let landed = false
  for (const group of groups.values()) {
    const run = await readRun()
    if (!run || run.status !== 'ACTIVE') return landed
    const runState = readRunState(run)
    const sourceActorId = group[0]!.sourceActorId
    if (!(await readRunActors(ctx, runState)).some((actor) => actor.id === sourceActorId)) continue
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
    const actor = actors.find(({ id }) => id === sourceActorId)
    if (!actor) continue
    const { target } = await prepareNativeLiveMovementTarget({
      scope,
      state: runState,
      actor,
      activeEffectsByActorId,
      captures,
      random: input.random
    })
    const { expectedCharacterStreamVersion: _stream, ...batch } = damageMirrorMechanicsBatch({
      state: runState,
      target,
      mirrors: group,
      ordinal: state.settledBatches,
      occurrenceId: group[0]!.occurrenceId,
      rootCommandId: group[0]!.rootCommandId,
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
