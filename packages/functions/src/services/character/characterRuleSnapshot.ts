import type { CharacterBuilderContext } from './builderService.js'
import {
  collectGrantedFeaturesForCharacter,
  deriveAbilityScores
} from './characterBuilderSelections.js'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot,
  EquippedState
} from '@artificer-toolkit/shared/core'
import {
  compileBackground,
  compileClass,
  compileFeat,
  compileFeature,
  compileRace,
  compileResolvedEquipment
} from '@artificer-toolkit/shared/compilers'
import {
  createCharacterDefinitionSourceInstanceId,
  createCharacterSpellSourceKey,
  toCharacterMechanicalAdjustment,
  type CharacterMovementDisplayPreference,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import type {
  CharacterAuthored,
  CharacterProvenance,
  CreatureAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'

export interface CharacterRuleSnapshotInput {
  character: CharacterAuthored
  context: CharacterBuilderContext
  adjustments?: readonly CharacterSheetAdjustment[]
  movementDisplayPreference?: CharacterMovementDisplayPreference
  companions?: readonly NonNullable<CharacterBuildSnapshot['companions']>[number][]
  creaturesById?: ReadonlyMap<string, CreatureAuthored>
}

export interface CharacterRuleSnapshotResult {
  snapshot: CharacterBuildSnapshot
  registry: CharacterAssemblyRegistry
}

function createAssemblyRegistry(context: CharacterBuilderContext): CharacterAssemblyRegistry {
  const { registry } = context
  const allFeatures = [
    ...registry.features,
    ...registry.races.flatMap((race) => [
      ...(race.features ?? []),
      ...(race.ancestry?.options.flatMap((option) => option.features ?? []) ?? [])
    ]),
    ...registry.classes.flatMap((classRecord) => classRecord.features ?? []),
    ...registry.backgrounds.flatMap((background) => background.features ?? []),
    ...(registry.feats ?? []).flatMap((feat) => feat.features ?? [])
  ]

  return {
    backgrounds: Object.fromEntries(
      registry.backgrounds.map((record) => [record.id, compileBackground(record)])
    ),
    classes: Object.fromEntries(
      registry.classes.map((record) => [record.id, compileClass(record)])
    ),
    equipment: Object.fromEntries(
      registry.equipment.map((record) => [record.id, compileResolvedEquipment(record)])
    ),
    feats: Object.fromEntries(
      (registry.feats ?? []).map((record) => [record.id, compileFeat(record)])
    ),
    features: Object.fromEntries(allFeatures.map((record) => [record.id, compileFeature(record)])),
    races: Object.fromEntries(registry.races.map((record) => [record.id, compileRace(record)])),
    spells: {},
    system: registry.system
      ? {
          skills: registry.system.skills ?? [],
          speeds: registry.system.speeds ?? []
        }
      : undefined
  }
}

function equippedStateForItem(item: CharacterAssemblyRegistry['equipment'][string]): EquippedState {
  switch (item?.category) {
    case 'ARMOR':
      return { slot: 'ARMOR' }
    case 'SHIELD':
      return { slot: 'SHIELD' }
    default:
      return { slot: 'GENERIC' }
  }
}

function featureTiming(
  character: CharacterAuthored,
  source: CharacterProvenance,
  availableAtLevel: number
): CharacterBuildSnapshot['features'][number]['timing'] {
  if (source.kind === 'CLASS') {
    return { kind: 'CLASS_LEVEL', classId: source.classId, classLevel: availableAtLevel }
  }
  if (source.kind === 'SUBCLASS') {
    const classIntent = character.intent.classes.find(
      (entry) => entry.subclassId === source.subclassId
    )
    if (classIntent) {
      return { kind: 'CLASS_LEVEL', classId: classIntent.classId, classLevel: availableAtLevel }
    }
  }
  return { kind: 'IMMEDIATE' }
}

function assembleFeatures(
  character: CharacterAuthored,
  context: CharacterBuilderContext
): CharacterBuildSnapshot['features'] {
  const { grantedFeatures } = collectGrantedFeaturesForCharacter(character, context.registry)
  const automatic = grantedFeatures.map((granted) => {
    const acquisition = character.intent.featureAcquisitions.find(
      (candidate) =>
        candidate.featureId === granted.feature.id &&
        isSameCharacterProvenanceIdentity(candidate.source, granted.source)
    )
    return {
      ...(acquisition ? { acquisitionId: acquisition.id } : {}),
      featureId: granted.feature.id,
      source: granted.source,
      timing:
        acquisition?.timing ??
        featureTiming(character, granted.source, granted.feature.availableAtLevel ?? 1),
      ...(acquisition?.selections ? { selections: acquisition.selections } : {})
    }
  })
  const explicit = character.intent.featureAcquisitions
    .filter(
      (acquisition) =>
        !automatic.some(
          (feature) =>
            feature.featureId === acquisition.featureId &&
            isSameCharacterProvenanceIdentity(feature.source, acquisition.source)
        )
    )
    .map((acquisition) => ({
      acquisitionId: acquisition.id,
      featureId: acquisition.featureId,
      source: acquisition.source,
      timing: acquisition.timing,
      ...(acquisition.selections ? { selections: acquisition.selections } : {})
    }))

  return [...automatic, ...explicit]
}

function assembleSpellSources(
  character: CharacterAuthored
): NonNullable<CharacterBuildSnapshot['spellSources']> {
  const sources = new Map<string, NonNullable<CharacterBuildSnapshot['spellSources']>[number]>()
  const classSelectionSources = new Map<
    string,
    { sourceKind: 'CLASS' | 'SUBCLASS'; sourceRecordId: string }
  >()
  for (const selection of character.intent.spellSelections ?? []) {
    if (selection.source.kind !== 'CLASS' && selection.source.kind !== 'SUBCLASS') continue
    const classId =
      selection.source.kind === 'CLASS'
        ? selection.source.classId
        : (() => {
            const subclassId = selection.source.subclassId
            return character.intent.classes.find((entry) => entry.subclassId === subclassId)
              ?.classId
          })()
    if (!classId) continue
    for (const spellId of selection.spells) {
      const key = `${classId}:${spellId}`
      if (!classSelectionSources.has(key)) {
        classSelectionSources.set(key, {
          sourceKind: selection.source.kind,
          sourceRecordId: selection.id
        })
      }
    }
  }
  const add = (
    spellId: string,
    sourceKind: NonNullable<CharacterBuildSnapshot['spellSources']>[number]['sourceKind'],
    sourceRecordId: string
  ) => {
    const source = {
      spellId,
      sourceKind,
      sourceInstanceId: createCharacterDefinitionSourceInstanceId(sourceKind, sourceRecordId)
    }
    sources.set(createCharacterSpellSourceKey(source), source)
  }
  for (const selection of character.intent.spellSelections ?? []) {
    for (const spellId of selection.spells) add(spellId, selection.source.kind, selection.id)
  }
  for (const classState of character.state.classes ?? []) {
    for (const spellId of [
      ...(classState.spells?.learned ?? []),
      ...(classState.spells?.prepared ?? [])
    ]) {
      const selected = classSelectionSources.get(`${classState.classId}:${spellId}`)
      add(spellId, selected?.sourceKind ?? 'CLASS', selected?.sourceRecordId ?? classState.classId)
    }
  }
  return [...sources.values()]
}

function assembleCompanions(
  character: CharacterAuthored,
  creaturesById: ReadonlyMap<string, CreatureAuthored> | undefined
): NonNullable<CharacterBuildSnapshot['companions']> {
  if (!creaturesById) return []
  return (character.state.creatures ?? []).flatMap((instance) => {
    const creature = creaturesById.get(instance.creatureId)
    if (!creature) return []
    return [
      {
        companionInstanceId: instance.id,
        creatureId: creature.id,
        abilityScores: { ...creature.abilityScores },
        armorClass: creature.armorClass,
        maxHitPoints: creature.hitPoints,
        size: creature.size,
        alignmentId: creature.alignmentId,
        creatureTypeId: creature.creatureTypeId
      }
    ]
  })
}

function present(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined
}

export function assembleCharacterRuleSnapshot(
  input: CharacterRuleSnapshotInput
): CharacterRuleSnapshotResult {
  const { character, context } = input
  const registry = createAssemblyRegistry(context)
  const grantedFeatures = assembleFeatures(character, context)
  const assigned = deriveAbilityScores(character.intent.abilities)
  const abilities: Record<string, number> = {}
  for (const [ability, score] of Object.entries(assigned)) {
    if (typeof score === 'number') abilities[ability] = score
  }
  const equippedIds = new Set(character.state.equipment.equipped)
  const attunedIds = new Set(character.state.equipment.attuned)
  const equipmentItems = character.state.equipment.inventory.flatMap((item) => {
    const compiledItem = registry.equipment[item.equipmentId]
    if (!compiledItem) return []
    const equippedState = equippedIds.has(item.id) ? equippedStateForItem(compiledItem) : undefined
    return [
      {
        instanceId: item.id,
        contentRef: {
          definitionId: item.equipmentId,
          binding: { kind: 'ACTIVE' as const },
          systemId: character.systemId
        },
        ...(equippedState ? { equippedState } : {}),
        attuned: attunedIds.has(item.id),
        compiledItem
      }
    ]
  })
  const snapshot: CharacterBuildSnapshot = {
    characterId: character.id,
    systemId: character.systemId,
    totalLevel: character.intent.classes.reduce((sum, entry) => sum + entry.classLevel, 0),
    raceId: present(character.intent.race.raceId),
    subraceId: present(character.intent.race.subraceId),
    backgroundId: present(character.intent.background.backgroundId),
    chosenGrantSelections: character.intent.chosenGrantSelections ?? [],
    classes: character.intent.classes.map((entry) => ({
      classId: entry.classId,
      level: entry.classLevel,
      subclassId: entry.subclassId,
      specializationId: entry.specializationId
    })),
    abilities,
    hitpoints: [...character.intent.hitpoints.levels]
      .sort((left, right) => left.level - right.level)
      .map(({ classId, classLevel, value }) => ({ classId, classLevel, value })),
    features: grantedFeatures,
    equipmentItems,
    spellSources: assembleSpellSources(character),
    companions: input.companions
      ? input.companions.map((companion) => ({
          ...companion,
          abilityScores: { ...companion.abilityScores }
        }))
      : assembleCompanions(character, input.creaturesById),
    adjustments: (input.adjustments ?? []).map(toCharacterMechanicalAdjustment),
    movementDisplayPreference: input.movementDisplayPreference ?? { mode: 'AUTO' }
  }
  return { snapshot, registry }
}
