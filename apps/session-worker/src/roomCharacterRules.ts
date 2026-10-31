import {
  liveSessionCharacterRulesInputSchema,
  type LiveSessionCharacterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { prepareLiveCharacterSheetFacts } from './nativeCharacterRules.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import { resolveCharacterRecordStats } from '@artificer-toolkit/rules-runtime/character/characterRecordStats'
import { effectiveHitPointMaximum } from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
import {
  readCharacterInventoryBase,
  readCharacterPlay
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { characterStoredPlayStateSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { RoomInputs } from './roomInputs.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'

/**
 * The caller admits the command through RoomAuthorization before reading its target's facts. Inside
 * a transaction the play is reconciled to the structure, unless the caller just wrote a play its
 * own rules already settled (`reconcile: false`): an outcome's effects land after its hit points,
 * so bounding them here would cut what its own grant allows (D156).
 */
export async function prepareRoomLiveCharacterSheet(
  store: RoomEncounterStore,
  room: RoomInputs,
  scope: LiveSessionCharacterRulesInput,
  observed: LiveSessionRulesRevisions | null,
  transaction?: RoomTransaction,
  { reconcile = true }: { reconcile?: boolean } = {}
) {
  const initialInput = liveSessionCharacterRulesInputSchema.parse(scope)
  if (room.epoch !== initialInput.authorityEpoch)
    throw new Error('Room Character rules epoch mismatch.')
  let [part, systemInput] = await Promise.all([
    room.character(initialInput.characterId, observed, transaction),
    room.system('SYSTEM', observed, transaction)
  ])
  const { system } = systemInput
  if (!part.inputs || !part.contentSnapshots || !system)
    throw new Error('Room Character rules inputs are missing.')
  if (part.contentSnapshots.systemId !== part.inputs.owner.systemId)
    throw new Error('Room Character content System mismatch.')
  const objects = await room.contentObjects(initialInput.characterId, observed, transaction)
  const sources = new Set(part.contentSnapshots.sources.map((source) => source.contentSourceId))
  for (const object of objects) {
    if (
      object.scope === 'CAMPAIGN'
        ? object.scopeId !== initialInput.campaignId
        : object.scope !== 'SOURCE' || !sources.has(object.scopeId)
    )
      throw new Error('Room content scope is unauthorized.')
  }
  const revisions = mergeNativeRulesRevisions(part.revisions, systemInput.revisions)
  const prepare = (inputs: NonNullable<typeof part.inputs>) =>
    prepareLiveCharacterSheetFacts({
      scope: initialInput,
      inputs,
      system,
      objects
    })
  let facts = await prepare(part.inputs)
  if (transaction && reconcile) {
    const play = await store.store
      .query('characterPlayStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', initialInput.characterId))
      .unique()
    if (
      !play ||
      play._id !== facts.active.play._id ||
      play.userId !== facts.active.userId ||
      play.checksum !== facts.active.play.checksum ||
      play.streamVersion !== facts.active.play.streamVersion
    )
      throw new Error('Room Character reconciliation base is stale.')
    const state = readCharacterPlay(play)
    const stats = resolveCharacterRecordStats(facts.ruleEvaluation)
    const resourcePools = new Set(
      facts.ruleEvaluation.output.resources.map((resource) => resource.poolId)
    )
    // A used-up item is hidden, not deleted: its equipped state and usage outlive its visibility so
    // an undo gives it back as it was. Only a row the structure no longer stores drops them.
    const inventoryIds = new Set(
      readCharacterInventoryBase(facts.active).inventory.map((item) => item.id)
    )
    const nextState = {
      ...state,
      hitpoints: {
        ...state.hitpoints,
        // The evaluated maximum includes Campaign adjustments; held grants (Aid) and reductions
        // apply on top, so this bound never cuts hit points a live grant allows.
        current: Math.min(
          state.hitpoints.current,
          effectiveHitPointMaximum(
            stats.maximumHitPoints,
            await listActiveRuleEffects(
              { db: store.store },
              { kind: 'CHARACTER', characterId: initialInput.characterId },
              { ownerVerified: true }
            ),
            state.hitpoints.maximumFraction
          )
        ),
        hitDice: facts.prepared.character.state.hitpoints.hitDice
      },
      equipped: state.equipped.filter(({ itemId }) => inventoryIds.has(itemId)),
      attuned: state.attuned.filter((itemId) => inventoryIds.has(itemId)),
      resourceUsage: state.resourceUsage.filter((usage) =>
        resourcePools.has(createCharacterResourceOwnerKey(usage.owner))
      ),
      itemUsage: state.itemUsage.filter((usage) => inventoryIds.has(usage.itemInstanceId)),
      itemDegradation: state.itemDegradation.filter((entry) =>
        inventoryIds.has(entry.itemInstanceId)
      )
    }
    const checksum = checksumRuleDocument(nextState)
    const stateChanged = checksum !== play.checksum
    if (
      stateChanged ||
      stats.maximumHitPoints !== play.maximumHitPoints ||
      canonicalizeJson(stats.speeds) !== canonicalizeJson(play.speeds)
    ) {
      const { _id, _creationTime, ...fields } = play
      await store.store.replace(
        _id,
        characterStoredPlayStateSchema.parse({
          ...fields,
          ...stats,
          state: nextState,
          checksum,
          streamVersion: play.streamVersion + (stateChanged ? 1 : 0),
          updatedAt: stateChanged
            ? new Date(Math.max(Date.now(), Date.parse(play.updatedAt) + 1)).toISOString()
            : play.updatedAt
        })
      )
      part = await room.character(initialInput.characterId, observed, transaction)
      if (!part.inputs) throw new Error('Room Character rules inputs are missing.')
      // Re-evaluate over the reconciled play without replacing the Builder's structure or reloading content.
      facts = await prepare(part.inputs)
    }
  }
  return { ...facts, revisions }
}

/**
 * A Character's rule evaluation as its Campaign owner reads it, the identity Convex's Encounter
 * ports read under. The caller admits the command first.
 */
export async function readRoomOwnerCharacterRules(
  store: RoomEncounterStore,
  room: RoomInputs,
  scope: {
    campaign: { id: string; ownerUserId: string }
    authorityEpoch: string
    characterId: string
  },
  observed: LiveSessionRulesRevisions | null,
  transaction?: RoomTransaction
) {
  const facts = await prepareRoomLiveCharacterSheet(
    store,
    room,
    {
      campaignId: scope.campaign.id,
      authorityEpoch: scope.authorityEpoch,
      expectedUserId: scope.campaign.ownerUserId,
      expectedRole: 'OWNER',
      characterId: scope.characterId
    },
    observed,
    transaction
  )
  return facts.ruleEvaluation
}
