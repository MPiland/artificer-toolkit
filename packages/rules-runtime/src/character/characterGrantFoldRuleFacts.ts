import type { CharacterGrantFoldInput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import { buildSkillSubjectAliasMap, resolveSkillAlias } from '@artificer-toolkit/shared/character'
import { getCharacterProvenanceIdentityKey } from '@artificer-toolkit/shared/subjects/authored'

import {
  buildCharacterGrantFoldProficiencyFacts,
  buildCharacterGrantFoldSourceFacts,
  buildGrantFoldEquipmentFacts,
  getCharacterGrantFoldSelectedOptionIds
} from './characterGrantFoldSourceFacts.js'

export function compileCharacterGrantFoldRuleFacts(params: {
  snapshot: CharacterBuildSnapshot
  registry: CharacterAssemblyRegistry
}): CharacterGrantFoldInput {
  const { snapshot, registry } = params
  const skillAliases = buildSkillSubjectAliasMap(registry.system)
  const normalizeProficiencyTarget = (kind: string, targetId: string): string => {
    if (targetId === '*') return targetId
    if (kind === 'SKILL') return resolveSkillAlias(targetId, skillAliases)
    return targetId
  }
  const featureIds = snapshot.features.map((feature) => feature.featureId)
  const optionIds = snapshot.features.flatMap((feature) => [
    ...getCharacterGrantFoldSelectedOptionIds(feature)
  ])
  const featIds = snapshot.features.flatMap((feature) =>
    feature.source.kind === 'FEAT' ? [feature.source.featId] : []
  )
  const heritageIds = new Set<string>()
  for (const id of [snapshot.raceId, snapshot.subraceId]) {
    for (const heritageId of (id ? registry.races[id]?.heritageIds : []) ?? []) {
      heritageIds.add(heritageId)
    }
  }

  const classes = snapshot.classes.map((record) => {
    const compiledClass = registry.classes[record.classId]
    const compiledSubclass = record.subclassId ? registry.classes[record.subclassId] : undefined
    const classOwner = { kind: 'CLASS', classId: record.classId } as const
    return {
      classId: record.classId,
      level: record.level,
      base: compiledClass
        ? {
            category: compiledClass.category,
            source: buildCharacterGrantFoldSourceFacts({
              definition: compiledClass,
              owner: classOwner,
              definitionId: compiledClass.id,
              snapshot,
              normalizeProficiencyTarget
            }),
            multiclassProficiencies:
              'multiclass' in compiledClass
                ? buildCharacterGrantFoldProficiencyFacts(
                    compiledClass.multiclass.proficiencies,
                    snapshot,
                    classOwner,
                    normalizeProficiencyTarget
                  )
                : []
          }
        : null,
      subclass: compiledSubclass
        ? {
            category: compiledSubclass.category,
            parentClassId:
              'parentClassId' in compiledSubclass ? compiledSubclass.parentClassId : null,
            source: buildCharacterGrantFoldSourceFacts({
              definition: compiledSubclass,
              owner: { kind: 'SUBCLASS', subclassId: compiledSubclass.id },
              definitionId: compiledSubclass.id,
              snapshot,
              normalizeProficiencyTarget
            })
          }
        : null
    }
  })

  const backgroundDefinition = snapshot.backgroundId
    ? registry.backgrounds?.[snapshot.backgroundId]
    : undefined
  const background =
    snapshot.backgroundId && backgroundDefinition
      ? buildCharacterGrantFoldSourceFacts({
          definition: backgroundDefinition,
          owner: { kind: 'BACKGROUND', backgroundId: snapshot.backgroundId },
          definitionId: backgroundDefinition.id,
          snapshot,
          normalizeProficiencyTarget
        })
      : null

  const featRoots = new Map<string, CharacterBuildSnapshot['features'][number]>()
  for (const feature of snapshot.features) {
    if (feature.source.kind !== 'FEAT') continue
    const current = featRoots.get(feature.source.featId)
    if (
      !current ||
      (current.featureId !== feature.source.featId && feature.featureId === feature.source.featId)
    )
      featRoots.set(feature.source.featId, feature)
  }
  const features = snapshot.features.map((feature) => {
    const definition = registry.features[feature.featureId]
    const acquisitionIdentity =
      feature.acquisitionId ??
      `${getCharacterProvenanceIdentityKey(feature.source)}:${feature.featureId}`
    const selected = getCharacterGrantFoldSelectedOptionIds(feature)
    const featId = feature.source.kind === 'FEAT' ? feature.source.featId : null
    // A Feat owns its root grants and charges once, independently of its child acquisitions.
    const featDefinition =
      featId && featRoots.get(featId) === feature ? registry.feats[featId] : undefined
    return {
      sourceKind: feature.source.kind,
      sourceClassLevel:
        (feature.source.kind === 'CLASS' || feature.source.kind === 'SUBCLASS') &&
        feature.source.classLevel !== undefined
          ? feature.source.classLevel
          : null,
      timingLevel:
        feature.timing.kind === 'CLASS_LEVEL'
          ? feature.timing.classLevel
          : feature.timing.kind === 'CHARACTER_LEVEL'
            ? feature.timing.level
            : null,
      definition: definition
        ? buildCharacterGrantFoldSourceFacts({
            definition,
            owner: feature.source,
            definitionId: feature.featureId,
            sourceInstanceId: acquisitionIdentity,
            snapshot,
            normalizeProficiencyTarget
          })
        : null,
      selectedOptions:
        feature.acquisitionId && definition
          ? (definition.options ?? [])
              .filter((option) => selected.has(option.id))
              .map((option) =>
                buildCharacterGrantFoldSourceFacts({
                  definition: option,
                  owner: {
                    kind: 'OPTION',
                    acquiredParentId: feature.acquisitionId!,
                    optionId: option.id
                  },
                  definitionId: option.id,
                  snapshot,
                  normalizeProficiencyTarget
                })
              )
          : [],
      featDefinition:
        featDefinition && feature.source.kind === 'FEAT'
          ? buildCharacterGrantFoldSourceFacts({
              definition: featDefinition,
              owner: feature.source,
              definitionId: feature.source.featId,
              sourceInstanceId:
                feature.acquisitionId ??
                `${getCharacterProvenanceIdentityKey(feature.source)}:${feature.source.featId}`,
              snapshot,
              normalizeProficiencyTarget
            })
          : null
    }
  })

  const { equipment, equipmentItems } = buildGrantFoldEquipmentFacts({
    items: snapshot.equipmentItems.map((item) => ({
      instanceId: item.instanceId,
      equipmentId: item.contentRef.definitionId,
      compiledItem: item.compiledItem,
      equipped: Boolean(item.equippedState),
      attuned: item.attuned
    })),
    snapshot,
    normalizeProficiencyTarget
  })

  const heritageRaceId = snapshot.subraceId ?? snapshot.raceId
  return {
    contractVersion: 1,
    base: {
      systemId: snapshot.systemId,
      totalLevel: snapshot.totalLevel,
      raceId: snapshot.raceId ?? null,
      subraceId: snapshot.subraceId ?? null,
      size: (heritageRaceId ? registry.races[heritageRaceId]?.size : undefined) ?? null,
      abilities: { ...snapshot.abilities },
      heritageIds: [...heritageIds],
      featureIds,
      optionIds,
      featIds,
      classes: snapshot.classes.map((entry) => ({
        classId: entry.classId,
        level: entry.level,
        spellcasting: Boolean(registry.classes[entry.classId]?.spellcasting),
        subclassId: entry.subclassId ?? null,
        specializationId: entry.specializationId ?? null
      })),
      equipment
    },
    // The parent character policy resolves included spell access before invoking
    // the locked grant-fold model and replaces this placeholder in that eval.
    upstreamSpellIds: [],
    classes,
    background,
    features,
    activeEffects: [],
    equipmentItems
  }
}
