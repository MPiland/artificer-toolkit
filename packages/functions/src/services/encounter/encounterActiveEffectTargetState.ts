import {
  createCampaignCharacterMechanicsProjectionRepository,
  createCharacterMechanicsProjectionRepository,
  createSystemVocabularySnapshotRepository,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord
} from '@artificer-toolkit/db'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import { resolveCharacterEffectiveMaximumHitPoints } from '@artificer-toolkit/shared/character'

import {
  checksumCampaignCharacterMechanicalContext,
  resolveCharacterLiveSessionRuleContext
} from '../character/campaignCharacterSheet.js'
import { CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION } from '../campaign/campaignCharacterMechanicsProjection.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { lockEncounterInitiativeCharacterSources } from './encounterInitiativeFactSources.js'

/**
 * Exact current target facts held under the established Encounter command
 * lock chain. Active-effect lifecycle rows are deliberately not owned here.
 */
export type LockedEncounterActiveEffectCharacter = {
  id: string
  systemId: string
  streamVersion: number
  actor: EncounterActorRecord
  mechanics: Awaited<
    ReturnType<ReturnType<typeof createCharacterMechanicsProjectionRepository>['requireCurrent']>
  >
  overlay: Awaited<
    ReturnType<
      ReturnType<typeof createCampaignCharacterMechanicsProjectionRepository>['requireCurrent']
    >
  >
  conditionDefinitions: readonly {
    id: string
    label: string
    description?: string | null
  }[]
  activeConditionDefinitionIds: readonly string[]
  maximumHitPoints: number
}

export type LockedEncounterActiveEffectTargets = {
  characterIds: readonly string[]
  encounterActorIds: readonly string[]
  lockedCharacters: ReadonlyMap<string, LockedEncounterActiveEffectCharacter>
  encounterActors: ReadonlyMap<string, EncounterActorRecord>
  encounterActorRules: EncounterActorRuleOutput | null
}

/**
 * Locks and verifies exact target facts after the caller has locked Campaign,
 * Session/lease, and Encounter. Character assignment rows precede sorted
 * Character roots; it never acquires active-effect lifecycle rows.
 */
export async function lockEncounterActiveEffectTargets(input: {
  trx: DBLike
  encounter: EncounterRecord
  actors: readonly EncounterActorRecord[]
  attunementSlotOverride: number | null
  getEncounterActorSnapshot?: () => Promise<{
    rules: EncounterActorRuleOutput
    encounter: EncounterRecord
  }>
}): Promise<LockedEncounterActiveEffectTargets> {
  const actorByCharacter = new Map<string, EncounterActorRecord>()
  const encounterActors = new Map<string, EncounterActorRecord>()
  for (const actor of input.actors) {
    if (actor.kind !== 'CHARACTER') {
      encounterActors.set(actor.id, actor)
      continue
    }
    if (!actor.sourceId) throw new EncounterValidationError('Character effect owner is incomplete.')
    const prior = actorByCharacter.get(actor.sourceId)
    if (prior && prior.id !== actor.id)
      throw new EncounterConflictError('A Character may appear only once in a turn-effect batch.')
    actorByCharacter.set(actor.sourceId, actor)
  }
  const characterIds = [...actorByCharacter.keys()].sort()
  const encounterActorIds = [...encounterActors.keys()].sort()
  const lockedCharacterSources = await lockEncounterInitiativeCharacterSources({
    trx: input.trx,
    encounter: input.encounter,
    actors: [...actorByCharacter.values()],
    attunementSlotOverride: input.attunementSlotOverride
  })
  const lockedCharacters = new Map<string, LockedEncounterActiveEffectCharacter>()
  for (const characterId of characterIds) {
    const source = lockedCharacterSources.get(characterId)!
    const { mechanics, overlay } = source
    const vocabulary = await createSystemVocabularySnapshotRepository(input.trx).findById(
      mechanics.systemVocabularySnapshotId
    )
    if (
      !vocabulary ||
      vocabulary.systemId !== source.systemId ||
      vocabulary.snapshotVersion !== mechanics.systemVocabularySnapshotVersion ||
      vocabulary.checksum !== mechanics.systemVocabularySnapshotChecksum
    )
      throw new EncounterConflictError('The Character System vocabulary snapshot is stale.')
    const activeConditionDefinitionIds = (mechanics.commandState.state.conditions ?? [])
      .map((condition) => condition.conditionTypeId)
      .sort()
    const vocabularyConditionIds = new Set(vocabulary.document.conditionTypes.map(({ id }) => id))
    if (
      new Set(activeConditionDefinitionIds).size !== activeConditionDefinitionIds.length ||
      activeConditionDefinitionIds.some((conditionId) => !vocabularyConditionIds.has(conditionId))
    )
      throw new EncounterConflictError('The Character condition state is stale.')
    lockedCharacters.set(characterId, {
      id: characterId,
      systemId: source.systemId,
      streamVersion: source.streamVersion,
      actor: source.actor,
      mechanics,
      overlay,
      conditionDefinitions: vocabulary.document.conditionTypes,
      activeConditionDefinitionIds,
      maximumHitPoints: resolveCharacterEffectiveMaximumHitPoints(
        overlay.rulePolicyOutput.derivedStats.maxHitPoints.effective
      )
    })
  }

  if (encounterActorIds.length > 0 && !input.getEncounterActorSnapshot)
    throw new EncounterValidationError('Encounter actor rules are required for active effects.')
  const snapshot = encounterActorIds.length > 0 ? await input.getEncounterActorSnapshot!() : null
  if (snapshot) {
    for (const actorId of encounterActorIds) {
      const reconciled = snapshot.encounter.actors.find((actor) => actor.id === actorId)
      if (!reconciled || reconciled.kind === 'CHARACTER')
        throw new EncounterConflictError('Encounter actor changed before active-effect execution.')
      encounterActors.set(reconciled.id, reconciled)
    }
  }

  return {
    characterIds,
    encounterActorIds,
    lockedCharacters,
    encounterActors,
    encounterActorRules: snapshot?.rules ?? null
  }
}

/**
 * Refreshes facts after an in-transaction rule application while the caller
 * still owns the canonical Character and spatial/effect locks. It must never
 * acquire Character roots again: doing so would invert the movement lock lane.
 */
export async function refreshLockedEncounterActiveEffectTargets(input: {
  trx: DBLike
  encounter: EncounterRecord
  targets: LockedEncounterActiveEffectTargets
  attunementSlotOverride: number | null
  getEncounterActorSnapshot?: () => Promise<{
    rules: EncounterActorRuleOutput
    encounter: EncounterRecord
  }>
}): Promise<LockedEncounterActiveEffectTargets> {
  const characterActors = new Map<string, EncounterActorRecord>()
  const nonCharacterActors = new Map<string, EncounterActorRecord>()
  for (const actor of input.encounter.actors) {
    if (actor.kind === 'CHARACTER') {
      if (!actor.sourceId) {
        throw new EncounterConflictError('Encounter Character target is incomplete.')
      }
      characterActors.set(actor.sourceId, actor)
    } else {
      nonCharacterActors.set(actor.id, actor)
    }
  }
  const characterIds = [...characterActors.keys()].sort()
  const encounterActorIds = [...nonCharacterActors.keys()].sort()
  if (
    JSON.stringify(characterIds) !== JSON.stringify(input.targets.characterIds) ||
    JSON.stringify(encounterActorIds) !== JSON.stringify(input.targets.encounterActorIds)
  ) {
    throw new EncounterConflictError('Encounter target membership changed during execution.')
  }

  const overlays = createCampaignCharacterMechanicsProjectionRepository(input.trx)
  const lockedCharacters = new Map<string, LockedEncounterActiveEffectCharacter>()
  for (const characterId of characterIds) {
    const prior = input.targets.lockedCharacters.get(characterId)
    const actor = characterActors.get(characterId)!
    if (!prior || actor.systemId !== prior.systemId) {
      throw new EncounterConflictError('Encounter Character target changed during execution.')
    }
    const root = await input.trx
      .selectFrom('characters')
      .select(['id', 'system_id', 'stream_version', 'status'])
      .where('id', '=', characterId)
      .executeTakeFirst()
    if (!root || root.status !== 'ACTIVE' || root.system_id !== prior.systemId) {
      throw new EncounterConflictError('Encounter Character target is stale.')
    }
    const mechanics = await createCharacterMechanicsProjectionRepository(input.trx).requireCurrent({
      characterId,
      expectedStreamVersion: root.stream_version
    })
    const ruleContext = await resolveCharacterLiveSessionRuleContext(input.trx, characterId, {
      id: input.encounter.campaignId,
      attunementSlotOverride: input.attunementSlotOverride
    })
    if (!ruleContext) {
      throw new EncounterConflictError('The Character Campaign rule context is stale.')
    }
    const overlay = await overlays.requireCurrent({
      campaignId: input.encounter.campaignId,
      characterId,
      expectedBaseMechanicsProjectionChecksum: mechanics.projectionChecksum,
      expectedCharacterStreamVersion: root.stream_version,
      expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
        adjustments: ruleContext.adjustments,
        attunementSlotOverride: ruleContext.attunementSlotOverride
      }),
      expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
      baseMechanicsProjection: mechanics
    })
    const vocabulary = await createSystemVocabularySnapshotRepository(input.trx).findById(
      mechanics.systemVocabularySnapshotId
    )
    if (
      !vocabulary ||
      vocabulary.systemId !== prior.systemId ||
      vocabulary.snapshotVersion !== mechanics.systemVocabularySnapshotVersion ||
      vocabulary.checksum !== mechanics.systemVocabularySnapshotChecksum
    ) {
      throw new EncounterConflictError('The Character System vocabulary snapshot is stale.')
    }
    const activeConditionDefinitionIds = (mechanics.commandState.state.conditions ?? [])
      .map((condition) => condition.conditionTypeId)
      .sort()
    const vocabularyConditionIds = new Set(vocabulary.document.conditionTypes.map(({ id }) => id))
    if (
      new Set(activeConditionDefinitionIds).size !== activeConditionDefinitionIds.length ||
      activeConditionDefinitionIds.some((conditionId) => !vocabularyConditionIds.has(conditionId))
    ) {
      throw new EncounterConflictError('The Character condition state is stale.')
    }
    lockedCharacters.set(characterId, {
      id: characterId,
      systemId: prior.systemId,
      streamVersion: root.stream_version,
      actor,
      mechanics,
      overlay,
      conditionDefinitions: vocabulary.document.conditionTypes,
      activeConditionDefinitionIds,
      maximumHitPoints: resolveCharacterEffectiveMaximumHitPoints(
        overlay.rulePolicyOutput.derivedStats.maxHitPoints.effective
      )
    })
  }

  if (encounterActorIds.length > 0 && !input.getEncounterActorSnapshot) {
    throw new EncounterValidationError('Encounter actor rules are required for active effects.')
  }
  const snapshot = encounterActorIds.length > 0 ? await input.getEncounterActorSnapshot!() : null
  const encounterActors = new Map<string, EncounterActorRecord>()
  for (const actorId of encounterActorIds) {
    const actor = snapshot?.encounter.actors.find((candidate) => candidate.id === actorId)
    if (!actor || actor.kind === 'CHARACTER') {
      throw new EncounterConflictError('Encounter actor changed during execution.')
    }
    encounterActors.set(actorId, actor)
  }
  return {
    characterIds,
    encounterActorIds,
    lockedCharacters,
    encounterActors,
    encounterActorRules: snapshot?.rules ?? null
  }
}
