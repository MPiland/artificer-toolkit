import {
  createActiveRuleEffectRepository,
  createCampaignCharacterMechanicsProjectionRepository,
  createCharacterMechanicsProjectionRepository,
  createSystemVocabularySnapshotRepository,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord
} from '@artificer-toolkit/db'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import { type CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import { resolveCharacterEffectiveMaximumHitPoints } from '@artificer-toolkit/shared/character'

import {
  checksumCampaignCharacterMechanicalContext,
  resolveCharacterLiveSessionRuleContext
} from '../character/campaignCharacterSheet.js'
import { CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION } from '../campaign/campaignCharacterMechanicsProjection.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import {
  characterBaseScalarValues,
  encounterActorBaseScalarValues,
  evaluateEffectiveCharacterPolicy,
  foldActiveScalarReductions,
  scalarValuesDiffer
} from './encounterEffectiveScalarPolicy.js'
import { lockEncounterInitiativeCharacterSources } from './encounterInitiativeFactSources.js'
import { evaluateEncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'

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
  baseScalarValues?: Readonly<Record<string, number>>
  effectiveScalarValues?: Readonly<Record<string, number>>
  effectiveRulePolicyOutput?: CharacterRulePolicyOutput
}

export type LockedEncounterActiveEffectTargets = {
  characterIds: readonly string[]
  encounterActorIds: readonly string[]
  lockedCharacters: ReadonlyMap<string, LockedEncounterActiveEffectCharacter>
  encounterActors: ReadonlyMap<string, EncounterActorRecord>
  baseScalarValuesByActorId?: ReadonlyMap<string, Readonly<Record<string, number>>>
  effectiveScalarValuesByActorId?: ReadonlyMap<string, Readonly<Record<string, number>>>
  /** Owner rows are locked with their target aggregate and are reusable for source-bound state. */
  activeEffectsByActorId: ReadonlyMap<
    string,
    Awaited<ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['lockByOwner']>>
  >
  encounterActorRules: EncounterActorRuleOutput | null
}

function activeMaximumHitPointReduction(input: {
  effects: Awaited<ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['lockByOwner']>>
}): number {
  let reduction = 0
  for (const effect of input.effects) {
    if (effect.definition.schemaVersion !== 2) continue
    for (const contribution of effect.definition.stateContributions) {
      if (contribution.kind !== 'HIT_POINT_MAXIMUM_REDUCTION') continue
      if (!Number.isSafeInteger(reduction + contribution.amount))
        throw new EncounterValidationError(
          'Active hit point maximum reductions exceed safe bounds.'
        )
      reduction += contribution.amount
    }
  }
  return reduction
}

export { foldActiveScalarReductions } from './encounterEffectiveScalarPolicy.js'

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
  const activeEffectsByActorId = new Map<
    string,
    Awaited<ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['lockByOwner']>>
  >()
  const baseScalarValuesByActorId = new Map<string, Readonly<Record<string, number>>>()
  const effectiveScalarValuesByActorId = new Map<string, Readonly<Record<string, number>>>()
  const activeEffects = createActiveRuleEffectRepository(input.trx)
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
    const baseMaximumHitPoints = resolveCharacterEffectiveMaximumHitPoints(
      overlay.rulePolicyOutput.derivedStats.maxHitPoints.effective
    )
    const effects = await activeEffects.lockByOwner({ kind: 'CHARACTER', characterId })
    const baseScalarValues = characterBaseScalarValues({ mechanics, overlay })
    activeEffectsByActorId.set(source.actor.id, effects)
    baseScalarValuesByActorId.set(source.actor.id, baseScalarValues)
    effectiveScalarValuesByActorId.set(
      source.actor.id,
      foldActiveScalarReductions({ baseScalarValues, effects })
    )
    const effectiveScalarValues = effectiveScalarValuesByActorId.get(source.actor.id)!
    const effectiveRulePolicyOutput =
      JSON.stringify(baseScalarValues) === JSON.stringify(effectiveScalarValues)
        ? undefined
        : await evaluateEffectiveCharacterPolicy({
            db: input.trx,
            character: { mechanics, overlay, systemId: source.systemId },
            baseScalarValues,
            effectiveScalarValues
          })
    lockedCharacters.set(characterId, {
      id: characterId,
      systemId: source.systemId,
      streamVersion: source.streamVersion,
      actor: source.actor,
      mechanics,
      overlay,
      conditionDefinitions: vocabulary.document.conditionTypes,
      activeConditionDefinitionIds,
      maximumHitPoints: Math.max(
        0,
        baseMaximumHitPoints - activeMaximumHitPointReduction({ effects })
      ),
      baseScalarValues,
      effectiveScalarValues,
      effectiveRulePolicyOutput
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
  for (const actorId of encounterActorIds) {
    const effects = await activeEffects.lockByOwner({
      kind: 'ENCOUNTER_ACTOR',
      encounterId: input.encounter.id,
      targetActorId: actorId
    })
    activeEffectsByActorId.set(actorId, effects)
    const baseScalarValues = encounterActorBaseScalarValues(encounterActors.get(actorId)!)
    baseScalarValuesByActorId.set(actorId, baseScalarValues)
    effectiveScalarValuesByActorId.set(
      actorId,
      foldActiveScalarReductions({ baseScalarValues, effects })
    )
  }

  const hasEffectiveEncounterActorScalarChange = [...effectiveScalarValuesByActorId].some(
    ([actorId, effectiveScalarValues]) =>
      scalarValuesDiffer(baseScalarValuesByActorId.get(actorId) ?? {}, effectiveScalarValues)
  )
  const effectiveEncounterActorRules =
    snapshot && hasEffectiveEncounterActorScalarChange
      ? (
          await evaluateEncounterActorRuleSnapshot({
            db: input.trx,
            encounter: snapshot.encounter,
            revisionId: input.encounter.rulePackRevisionId,
            effectiveScalarValuesByActorId
          })
        ).snapshot.output
      : (snapshot?.rules ?? null)
  return {
    characterIds,
    encounterActorIds,
    lockedCharacters,
    encounterActors,
    activeEffectsByActorId,
    baseScalarValuesByActorId,
    effectiveScalarValuesByActorId,
    encounterActorRules: effectiveEncounterActorRules
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
  const activeEffects = createActiveRuleEffectRepository(input.trx)
  const activeEffectsByActorId = new Map<
    string,
    Awaited<ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['lockByOwner']>>
  >()
  const baseScalarValuesByActorId = new Map<string, Readonly<Record<string, number>>>()
  const effectiveScalarValuesByActorId = new Map<string, Readonly<Record<string, number>>>()
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
    const baseMaximumHitPoints = resolveCharacterEffectiveMaximumHitPoints(
      overlay.rulePolicyOutput.derivedStats.maxHitPoints.effective
    )
    const effects = await activeEffects.lockByOwner({ kind: 'CHARACTER', characterId })
    const baseScalarValues = characterBaseScalarValues({ mechanics, overlay })
    activeEffectsByActorId.set(actor.id, effects)
    baseScalarValuesByActorId.set(actor.id, baseScalarValues)
    effectiveScalarValuesByActorId.set(
      actor.id,
      foldActiveScalarReductions({ baseScalarValues, effects })
    )
    const effectiveScalarValues = effectiveScalarValuesByActorId.get(actor.id)!
    const effectiveRulePolicyOutput =
      JSON.stringify(baseScalarValues) === JSON.stringify(effectiveScalarValues)
        ? undefined
        : await evaluateEffectiveCharacterPolicy({
            db: input.trx,
            character: { mechanics, overlay, systemId: prior.systemId },
            baseScalarValues,
            effectiveScalarValues
          })
    lockedCharacters.set(characterId, {
      id: characterId,
      systemId: prior.systemId,
      streamVersion: root.stream_version,
      actor,
      mechanics,
      overlay,
      conditionDefinitions: vocabulary.document.conditionTypes,
      activeConditionDefinitionIds,
      maximumHitPoints: Math.max(
        0,
        baseMaximumHitPoints - activeMaximumHitPointReduction({ effects })
      ),
      baseScalarValues,
      effectiveScalarValues,
      effectiveRulePolicyOutput
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
    const effects = await activeEffects.lockByOwner({
      kind: 'ENCOUNTER_ACTOR',
      encounterId: input.encounter.id,
      targetActorId: actorId
    })
    activeEffectsByActorId.set(actorId, effects)
    const baseScalarValues = encounterActorBaseScalarValues(actor)
    baseScalarValuesByActorId.set(actorId, baseScalarValues)
    effectiveScalarValuesByActorId.set(
      actorId,
      foldActiveScalarReductions({ baseScalarValues, effects })
    )
  }
  const hasEffectiveEncounterActorScalarChange = [...effectiveScalarValuesByActorId].some(
    ([actorId, effectiveScalarValues]) =>
      scalarValuesDiffer(baseScalarValuesByActorId.get(actorId) ?? {}, effectiveScalarValues)
  )
  const effectiveEncounterActorRules =
    snapshot && hasEffectiveEncounterActorScalarChange
      ? (
          await evaluateEncounterActorRuleSnapshot({
            db: input.trx,
            encounter: snapshot.encounter,
            revisionId: input.encounter.rulePackRevisionId,
            effectiveScalarValuesByActorId
          })
        ).snapshot.output
      : (snapshot?.rules ?? null)
  return {
    characterIds,
    encounterActorIds,
    lockedCharacters,
    encounterActors,
    activeEffectsByActorId,
    baseScalarValuesByActorId,
    effectiveScalarValuesByActorId,
    encounterActorRules: effectiveEncounterActorRules
  }
}
