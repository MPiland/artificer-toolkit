import {
  liveSessionCharacterRulesInputSchema,
  type LiveSessionCharacterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { prepareLiveCharacterSheetFacts } from './nativeCharacterRules.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import { resolveCharacterRecordStats } from '@artificer-toolkit/rules-runtime/character/characterRecordStats'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { characterStoredPlayStateSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { RoomInputs } from './roomInputs.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'

/** The caller admits the command through RoomAuthorization before reading its target's facts. */
export async function prepareRoomLiveCharacterSheet(
  store: RoomEncounterStore,
  room: RoomInputs,
  scope: LiveSessionCharacterRulesInput,
  observed: LiveSessionRulesRevisions | null,
  transaction?: RoomTransaction
) {
  const initialInput = liveSessionCharacterRulesInputSchema.parse(scope)
  if (room.epoch !== initialInput.authorityEpoch)
    throw new Error('Room Character rules epoch mismatch.')
  const priorBuilder = room.characterBuilderSnapshot(initialInput.characterId, transaction)
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
  if (transaction) {
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
    const inventoryIds = new Set(
      facts.prepared.character.state.equipment.inventory.map((item) => item.id)
    )
    const builder = room.characterBuilderSnapshot(initialInput.characterId, transaction)
    const clampsHitPoints =
      priorBuilder &&
      builder &&
      priorBuilder.updatedAt !== builder.updatedAt &&
      stats.maximumHitPoints < play.maximumHitPoints &&
      state.hitpoints.current > stats.maximumHitPoints
    const nextState = {
      ...state,
      hitpoints: {
        ...state.hitpoints,
        current: clampsHitPoints ? stats.maximumHitPoints : state.hitpoints.current,
        hitDice: facts.prepared.character.state.hitpoints.hitDice
      },
      equipped: state.equipped.filter((itemId) => inventoryIds.has(itemId)),
      attuned: state.attuned.filter((itemId) => inventoryIds.has(itemId)),
      resourceUsage: state.resourceUsage.filter((usage) =>
        resourcePools.has(createCharacterResourceOwnerKey(usage.owner))
      )
    }
    const checksum = checksumRuleDocument(nextState)
    const stateChanged = checksum !== play.checksum
    if (
      stateChanged ||
      stats.maximumHitPoints !== play.maximumHitPoints ||
      stats.walkingSpeed !== play.walkingSpeed
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
