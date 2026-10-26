import type { CharacterRuleContext } from './characterRuleContext.js'
import {
  collectGrantedFeaturesForCharacter,
  collectCharacterBuilderFeatures,
  deriveAbilityScores,
  findCurrentCharacterFeatureAcquisition,
  isCharacterAcquisitionTimingAvailable,
  isCharacterFeatAcquisitionValid
} from './characterBuilderSelections.js'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import type {
  CompiledCreature,
  CompiledEquipment
} from '@artificer-toolkit/shared/subjects/compilers'

import { requireDnd5eArmorClass } from '../systems/dnd5e/armorClass.js'
import { resolveDnd5eCreatureArmorClass } from '../systems/dnd5e/characterVitals.js'
import {
  createCharacterDefinitionSourceInstanceId,
  createCharacterSpellSourceKey,
  toCharacterMechanicalAdjustment,
  type CharacterMovementDisplayPreference,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import type {
  CharacterAuthored,
  CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'
import { assembleClassRitualSources } from './classRitualSources.js'

export interface CharacterRuleSnapshotInput {
  character: CharacterAuthored
  context: CharacterRuleContext
  adjustments?: readonly CharacterSheetAdjustment[]
  movementDisplayPreference?: CharacterMovementDisplayPreference
  companions?: readonly NonNullable<CharacterBuildSnapshot['companions']>[number][]
  creaturesById?: ReadonlyMap<string, CompiledCreature>
}

export interface CharacterRuleSnapshotResult {
  snapshot: CharacterBuildSnapshot
  registry: CharacterAssemblyRegistry
}

/** Compiled authorized sources from one immutable backend context; never retain across transactions. */
export function prepareCharacterRuleSources(context: CharacterRuleContext) {
  return { context, registry: createAssemblyRegistry(context) }
}

function createAssemblyRegistry(context: CharacterRuleContext): CharacterAssemblyRegistry {
  const { registry } = context
  const vocabulary = context.vocabularySnapshot?.document
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
    backgrounds: Object.fromEntries(registry.backgrounds.map((record) => [record.id, record])),
    classes: Object.fromEntries(registry.classes.map((record) => [record.id, record])),
    equipment: Object.fromEntries(registry.equipment.map((record) => [record.id, record])),
    feats: Object.fromEntries((registry.feats ?? []).map((record) => [record.id, record])),
    features: Object.fromEntries(allFeatures.map((record) => [record.id, record])),
    races: Object.fromEntries(registry.races.map((record) => [record.id, record])),
    spells: {},
    system: registry.system
      ? {
          abilities: vocabulary?.abilities ?? [],
          skills: vocabulary?.skills ?? [],
          speeds: registry.system.speeds ?? [],
          defaults: registry.system.defaults
        }
      : undefined
  }
}

function featureTiming(
  character: CharacterAuthored,
  source: CharacterProvenance,
  availableAtLevel: number
): CharacterBuildSnapshot['features'][number]['timing'] {
  if (source.kind === 'CLASS') {
    return {
      kind: 'CLASS_LEVEL',
      classId: source.classId,
      classLevel: availableAtLevel
    }
  }
  if (source.kind === 'SUBCLASS') {
    const classIntent = character.intent.classes.find(
      (entry) => entry.subclassId === source.subclassId
    )
    if (classIntent) {
      return {
        kind: 'CLASS_LEVEL',
        classId: classIntent.classId,
        classLevel: availableAtLevel
      }
    }
  }
  return { kind: 'IMMEDIATE' }
}

function assembleFeatures(
  character: CharacterAuthored,
  context: CharacterRuleContext
): CharacterBuildSnapshot['features'] {
  const { grantedFeatures } = collectGrantedFeaturesForCharacter(character, context.registry)
  const availableFeatures = collectCharacterBuilderFeatures(
    character,
    context.registry,
    grantedFeatures
  )
  const automatic = grantedFeatures.map((granted) => {
    const acquisition = findCurrentCharacterFeatureAcquisition(
      character,
      granted.feature.id,
      granted.source
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
        isCharacterAcquisitionTimingAvailable(character, acquisition.timing) &&
        isCharacterFeatAcquisitionValid(acquisition, context.registry) &&
        (acquisition.source.kind !== 'FEAT' ||
          acquisition.featureId === acquisition.source.featId ||
          availableFeatures.some(
            (record) =>
              record.feature.id === acquisition.featureId &&
              isSameCharacterProvenanceIdentity(record.source, acquisition.source)
          )) &&
        !automatic.some((feature) => feature.acquisitionId === acquisition.id)
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
  creaturesById: ReadonlyMap<string, CompiledCreature> | undefined,
  loadoutEquipmentById: Readonly<Record<string, CompiledEquipment>> | undefined
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
        armorClass: requireDnd5eArmorClass(
          resolveDnd5eCreatureArmorClass({
            abilityScores: creature.abilityScores,
            naturalArmorBonus: creature.naturalArmorBonus,
            equipment: (creature.equipmentLoadout ?? []).map((entry) => {
              const equipment = loadoutEquipmentById?.[entry.equipmentId]
              if (!equipment)
                throw new Error('A companion Creature loadout Equipment is unavailable.')
              return {
                id: entry.id,
                useState: entry.useState,
                compiled: equipment
              }
            })
          })
        ),
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
  input: CharacterRuleSnapshotInput,
  sources?: ReturnType<typeof prepareCharacterRuleSources>
): CharacterRuleSnapshotResult {
  const { character, context } = input
  if (sources && sources.context !== context)
    throw new Error('Character rule source preparation context mismatch.')
  const registry = sources?.registry ?? createAssemblyRegistry(context)
  const grantedFeatures = assembleFeatures(character, context)
  const abilities = deriveAbilityScores(character.intent.abilities)
  const equippedSlots = new Map(
    character.state.equipment.equipped.map(({ itemId, slot }) => [itemId, slot])
  )
  const attunedIds = new Set(character.state.equipment.attuned)
  const equipmentItems = character.state.equipment.inventory.flatMap((item) => {
    const acquired = context.registry.acquiredEquipmentByItemId?.get(item.id)
    const compiledItem = acquired ? acquired.equipment : registry.equipment[item.equipmentId]
    if (!compiledItem) return []
    const slot = equippedSlots.get(item.id)
    return [
      {
        instanceId: item.id,
        contentRef: {
          definitionId: item.equipmentId,
          binding: acquired
            ? { kind: 'REVISION' as const, revisionId: acquired.versionId }
            : { kind: 'ACTIVE' as const },
          systemId: character.systemId
        },
        ...(slot ? { equippedState: { slot } } : {}),
        attuned: attunedIds.has(item.id),
        ...(item.degradation === undefined ? {} : { degradation: item.degradation }),
        compiledItem
      }
    ]
  })
  const classRitualSources = assembleClassRitualSources(character, registry, context.catalog.spells)
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
      .map(({ classId, classLevel, value }) => ({
        classId,
        classLevel,
        value
      })),
    features: grantedFeatures,
    equipmentItems,
    spellSources: assembleSpellSources(character),
    ...(classRitualSources.length > 0 ? { classRitualSources } : {}),
    companions: input.companions
      ? input.companions.map((companion) => ({
          ...companion,
          abilityScores: { ...companion.abilityScores }
        }))
      : assembleCompanions(
          character,
          input.creaturesById,
          context.registry.creatureLoadoutEquipmentById
        ),
    adjustments: (input.adjustments ?? []).map(toCharacterMechanicalAdjustment),
    movementDisplayPreference: input.movementDisplayPreference ?? {
      mode: 'AUTO'
    }
  }
  return { snapshot, registry }
}
