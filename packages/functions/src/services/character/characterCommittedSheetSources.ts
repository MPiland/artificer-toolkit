import {
  createAuthoredVersionRepository,
  createSystemVocabularySnapshotRepository,
  type AuthoredVersionRecord,
  type DBLike
} from '@artificer-toolkit/db'
import type {
  AuthoredSubjectKind,
  AuthoredVersionVector,
} from '@artificer-toolkit/schema/projections/identity'
import type {
  CharacterMechanicsProjectionMetadata
} from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { RACE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import {
  resolveEquipmentAuthored,
  resolveRaceAuthored,
  type ResolvedEquipment,
  type ResolvedRace
} from '@artificer-toolkit/shared/subjects/compilers'
import type {
  BackgroundAuthored,
  CharacterAuthored,
  ClassAuthored,
  CreatureAuthored,
  EquipmentAuthored,
  FeatAuthored,
  RaceAuthored,
  SpellAuthored,
  VehicleAuthored
} from '@artificer-toolkit/shared/subjects/authored'

import type {
  CharacterBuilderCatalog,
  CharacterBuilderEquipmentCatalogRecord
} from './builderCatalog.js'
import type {
  CharacterBuilderGrantedContent,
  CharacterBuilderRegistry,
  CharacterBuilderResolution,
  CharacterBuilderSummary
} from './builderService.js'
import { collectGrantedFeaturesForCharacter, deriveAbilityScores } from './characterBuilderSelections.js'

export class CharacterCommittedSheetSourcesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterCommittedSheetSourcesError'
  }
}

type CharacterCommittedSheetSourceIdentity = Pick<
  CharacterMechanicsProjectionMetadata,
  | 'authoredVersionVector'
  | 'characterId'
  | 'systemVocabularySnapshotChecksum'
  | 'systemVocabularySnapshotId'
  | 'systemVocabularySnapshotVersion'
>

function authoredRootKey(
  entry: Pick<AuthoredVersionVector[number], 'subjectId' | 'subjectKind'>
): string {
  return `${entry.subjectKind}:${entry.subjectId}`
}

function hasExactVersion(
  actual: AuthoredVersionVector[number] | undefined,
  expected: AuthoredVersionVector[number]
): boolean {
  return (
    actual?.versionId === expected.versionId &&
    actual.version === expected.version &&
    actual.checksum === expected.checksum
  )
}

export function assertCharacterCommittedSheetSourceIdentity(input: {
  mechanics: CharacterCommittedSheetSourceIdentity
  recordsByRoot: ReadonlyMap<string, AuthoredVersionRecord>
  vocabularySnapshot: SystemVocabularySnapshot | null
}): asserts input is {
  mechanics: CharacterCommittedSheetSourceIdentity
  recordsByRoot: ReadonlyMap<string, AuthoredVersionRecord>
  vocabularySnapshot: SystemVocabularySnapshot
} {
  const vectorByRoot = new Map<string, AuthoredVersionVector[number]>()
  for (const entry of input.mechanics.authoredVersionVector) {
    const key = authoredRootKey(entry)
    if (vectorByRoot.has(key)) {
      throw new CharacterCommittedSheetSourcesError(
        `Character "${input.mechanics.characterId}" has duplicate authored dependency "${key}".`
      )
    }
    vectorByRoot.set(key, entry)
  }

  for (const [key, entry] of vectorByRoot) {
    const record = input.recordsByRoot.get(key)
    if (
      !record ||
      record.authored.subjectKind !== entry.subjectKind ||
      record.authored.subjectId !== entry.subjectId ||
      record.authored.versionId !== entry.versionId ||
      record.authored.version !== entry.version ||
      record.authored.checksum !== entry.checksum
    ) {
      throw new CharacterCommittedSheetSourcesError(
        `Character "${input.mechanics.characterId}" is missing exact authored dependency "${key}".`
      )
    }
  }

  for (const [key, record] of input.recordsByRoot) {
    const expected = vectorByRoot.get(key)
    if (!expected) {
      throw new CharacterCommittedSheetSourcesError(
        `Character "${input.mechanics.characterId}" loaded unexpected authored dependency "${key}".`
      )
    }
    for (const dependency of record.compiled.authoredDependencies) {
      const actual = vectorByRoot.get(authoredRootKey(dependency))
      if (!hasExactVersion(actual, dependency)) {
        throw new CharacterCommittedSheetSourcesError(
          `Character "${input.mechanics.characterId}" is missing exact transitive dependency for "${key}".`
        )
      }
    }
  }

  const snapshot = input.vocabularySnapshot
  if (
    !snapshot ||
    snapshot.snapshotId !== input.mechanics.systemVocabularySnapshotId ||
    snapshot.snapshotVersion !== input.mechanics.systemVocabularySnapshotVersion ||
    snapshot.checksum !== input.mechanics.systemVocabularySnapshotChecksum
  ) {
    throw new CharacterCommittedSheetSourcesError(
      `Character "${input.mechanics.characterId}" has an unavailable or mismatched vocabulary snapshot.`
    )
  }
}

export interface CharacterCommittedSheetSources {
  mechanics: CharacterCommittedSheetSourceIdentity
  recordsByRoot: ReadonlyMap<string, AuthoredVersionRecord>
  vocabularySnapshot: SystemVocabularySnapshot
}

function toAuthoredVersionVectorEntry(
  record: AuthoredVersionRecord
): AuthoredVersionVector[number] {
  return {
    subjectKind: record.authored.subjectKind,
    subjectId: record.authored.subjectId,
    versionId: record.authored.versionId,
    version: record.authored.version,
    checksum: record.authored.checksum
  }
}

function sortAuthoredVersionVector(
  vector: Iterable<AuthoredVersionVector[number]>
): AuthoredVersionVector {
  return [...vector].sort((left, right) => {
    const leftKey = authoredRootKey(left)
    const rightKey = authoredRootKey(right)
    return leftKey.localeCompare(rightKey)
  })
}

export async function extendCharacterCommittedSheetSourcesWithActiveRoots(input: {
  db: DBLike
  roots: readonly { subjectId: string; subjectKind: AuthoredSubjectKind }[]
  sources: CharacterCommittedSheetSources
  systemId: string
  userId: string
}): Promise<CharacterCommittedSheetSources> {
  const rootsByKind = new Map<AuthoredSubjectKind, Set<string>>()
  for (const root of input.roots) {
    const ids = rootsByKind.get(root.subjectKind) ?? new Set<string>()
    ids.add(root.subjectId)
    rootsByKind.set(root.subjectKind, ids)
  }
  if (rootsByKind.size === 0) return input.sources

  const repository = createAuthoredVersionRepository(input.db)
  const recordsByRoot = new Map(input.sources.recordsByRoot)
  const vectorByRoot = new Map(
    input.sources.mechanics.authoredVersionVector.map((entry) => [authoredRootKey(entry), entry])
  )
  const pendingDependencies = new Map<string, AuthoredVersionVector[number]>()
  const addVectorEntry = (entry: AuthoredVersionVector[number]) => {
    const key = authoredRootKey(entry)
    const existing = vectorByRoot.get(key)
    if (existing && !hasExactVersion(existing, entry)) {
      throw new CharacterCommittedSheetSourcesError(
        `Character "${input.sources.mechanics.characterId}" requires an explicit content upgrade before binding ${key}.`
      )
    }
    vectorByRoot.set(key, entry)
  }
  const addRecord = (record: AuthoredVersionRecord) => {
    const entry = toAuthoredVersionVectorEntry(record)
    addVectorEntry(entry)
    recordsByRoot.set(authoredRootKey(entry), record)
  }

  const activeRecordGroups = await Promise.all(
    [...rootsByKind.entries()].map(async ([subjectKind, subjectIds]) => [
      subjectKind,
      await repository.findActiveByIds({
        subjectKind,
        subjectIds: [...subjectIds],
        systemId: input.systemId,
        userId: input.userId,
        includeMaster: true
      })
    ] as const)
  )
  for (const [subjectKind, records] of activeRecordGroups) {
    for (const subjectId of rootsByKind.get(subjectKind) ?? []) {
      const record = records.get(subjectId)
      if (!record) {
        throw new CharacterCommittedSheetSourcesError(
          `Character "${input.sources.mechanics.characterId}" requires an active ${subjectKind} "${subjectId}" version.`
        )
      }
      addRecord(record)
    }
  }

  const visitedRoots = new Set<string>()
  while (true) {
    for (const [key, record] of recordsByRoot) {
      if (visitedRoots.has(key)) continue
      visitedRoots.add(key)
      for (const dependency of record.compiled.authoredDependencies) {
        addVectorEntry(dependency)
        if (!recordsByRoot.has(authoredRootKey(dependency))) {
          pendingDependencies.set(authoredRootKey(dependency), dependency)
        }
      }
    }
    const pending = [...pendingDependencies.values()].filter(
      (dependency) => !recordsByRoot.has(authoredRootKey(dependency))
    )
    if (pending.length === 0) break
    pendingDependencies.clear()
    const dependencyRecords = await repository.findExactVersions({ entries: pending })
    if (dependencyRecords.size !== pending.length) {
      throw new CharacterCommittedSheetSourcesError(
        `Character "${input.sources.mechanics.characterId}" could not load every authored dependency for a new source.`
      )
    }
    for (const record of dependencyRecords.values()) addRecord(record)
  }

  const mechanics = {
    ...input.sources.mechanics,
    authoredVersionVector: sortAuthoredVersionVector(vectorByRoot.values())
  }
  const extended = {
    mechanics,
    recordsByRoot,
    vocabularySnapshot: input.sources.vocabularySnapshot
  }
  assertCharacterCommittedSheetSourceIdentity(extended)
  return extended
}

export function pruneCharacterCommittedSheetSourcesRoots(input: {
  roots: readonly { subjectId: string; subjectKind: 'CREATURE' | 'VEHICLE' }[]
  sources: CharacterCommittedSheetSources
}): CharacterCommittedSheetSources {
  if (input.roots.length === 0) return input.sources
  const recordsByRoot = new Map(input.sources.recordsByRoot)
  const vectorByRoot = new Map(
    input.sources.mechanics.authoredVersionVector.map((entry) => [authoredRootKey(entry), entry])
  )
  for (const root of input.roots) {
    const key = authoredRootKey(root)
    const record = recordsByRoot.get(key)
    if (!record || !vectorByRoot.has(key)) {
      throw new CharacterCommittedSheetSourcesError(
        `Character "${input.sources.mechanics.characterId}" cannot prune unavailable authored source ${key}.`
      )
    }
    if (record.compiled.authoredDependencies.length > 0) {
      throw new CharacterCommittedSheetSourcesError(
        `Character "${input.sources.mechanics.characterId}" cannot prune ${key} while it has authored dependencies.`
      )
    }
    recordsByRoot.delete(key)
    vectorByRoot.delete(key)
  }
  const mechanics = {
    ...input.sources.mechanics,
    authoredVersionVector: sortAuthoredVersionVector(vectorByRoot.values())
  }
  const pruned = {
    mechanics,
    recordsByRoot,
    vocabularySnapshot: input.sources.vocabularySnapshot
  }
  assertCharacterCommittedSheetSourceIdentity(pruned)
  return pruned
}

function documentsFromRecords(recordsByRoot: ReadonlyMap<string, AuthoredVersionRecord>): {
  backgrounds: BackgroundAuthored[]
  classes: ClassAuthored[]
  creatures: CreatureAuthored[]
  equipment: EquipmentAuthored[]
  feats: FeatAuthored[]
  races: RaceAuthored[]
  spells: SpellAuthored[]
  vehicles: VehicleAuthored[]
} {
  const backgrounds: BackgroundAuthored[] = []
  const classes: ClassAuthored[] = []
  const creatures: CreatureAuthored[] = []
  const equipment: EquipmentAuthored[] = []
  const feats: FeatAuthored[] = []
  const races: RaceAuthored[] = []
  const spells: SpellAuthored[] = []
  const vehicles: VehicleAuthored[] = []
  for (const record of recordsByRoot.values()) {
    switch (record.authored.subjectKind) {
      case 'BACKGROUND':
        backgrounds.push(record.authored.document as unknown as BackgroundAuthored)
        break
      case 'CLASS':
        classes.push(record.authored.document as unknown as ClassAuthored)
        break
      case 'EQUIPMENT':
        equipment.push(record.authored.document as unknown as EquipmentAuthored)
        break
      case 'FEAT':
        feats.push(record.authored.document as unknown as FeatAuthored)
        break
      case 'RACE':
        races.push(record.authored.document as unknown as RaceAuthored)
        break
      case 'SPELL':
        spells.push(record.authored.document as unknown as SpellAuthored)
        break
      case 'CREATURE':
        creatures.push(record.authored.document as unknown as CreatureAuthored)
        break
      case 'VEHICLE':
        vehicles.push(record.authored.document as unknown as VehicleAuthored)
        break
    }
  }
  return { backgrounds, classes, creatures, equipment, feats, races, spells, vehicles }
}

function collectNestedFeatures(input: {
  backgrounds: readonly BackgroundAuthored[]
  classes: readonly ClassAuthored[]
  equipment: readonly ResolvedEquipment[]
  feats: readonly FeatAuthored[]
  races: readonly ResolvedRace[]
}): FeatureAuthored[] {
  const byId = new Map<string, FeatureAuthored>()
  const add = (features: readonly FeatureAuthored[] | undefined) => {
    for (const feature of features ?? []) byId.set(feature.id, feature)
  }
  for (const background of input.backgrounds)
    add(background.features as unknown as readonly FeatureAuthored[] | undefined)
  for (const classRecord of input.classes)
    add(classRecord.features as unknown as readonly FeatureAuthored[] | undefined)
  for (const equipment of input.equipment)
    add(equipment.features as unknown as readonly FeatureAuthored[] | undefined)
  for (const feat of input.feats)
    add(feat.features as unknown as readonly FeatureAuthored[] | undefined)
  for (const race of input.races) {
    add(race.features as unknown as readonly FeatureAuthored[] | undefined)
    for (const option of race.ancestry?.options ?? [])
      add(option.features as unknown as readonly FeatureAuthored[] | undefined)
  }
  return [...byId.values()]
}

function createExactBuilderRegistry(input: {
  recordsByRoot: ReadonlyMap<string, AuthoredVersionRecord>
  vocabularySnapshot: SystemVocabularySnapshot
}): CharacterBuilderRegistry {
  const documents = documentsFromRecords(input.recordsByRoot)
  const racesById = new Map(documents.races.map((record) => [record.id, record]))
  const equipmentById = new Map(documents.equipment.map((record) => [record.id, record]))
  const races = documents.races.map((race) =>
    resolveRaceAuthored(race, (parentId) => racesById.get(parentId))
  )
  const equipment = documents.equipment.map((record) =>
    resolveEquipmentAuthored(record, (parentId) => equipmentById.get(parentId))
  )
  return {
    system: input.vocabularySnapshot.document,
    races,
    classes: documents.classes,
    backgrounds: documents.backgrounds,
    equipment,
    feats: documents.feats,
    features: collectNestedFeatures({
      backgrounds: documents.backgrounds,
      classes: documents.classes,
      equipment,
      feats: documents.feats,
      races
    })
  }
}

function createExactCatalog(input: CharacterBuilderRegistry & { spells: readonly SpellAuthored[] }): CharacterBuilderCatalog {
  return {
    races: input.races.map((race) => ({
      id: race.id,
      label: race.label,
      category: race.category,
      parentRaceId: race.category === RACE_CATEGORY_CODE.SUBRACE ? race.parentRaceId : undefined,
      description: race.description,
      selectionMode: race.category === RACE_CATEGORY_CODE.BASE ? race.selectionMode : undefined
    })),
    classes: input.classes.map((record) => ({
      id: record.id,
      label: record.label,
      category: record.category,
      parentClassId: record.category === 'SUBCLASS' ? record.parentClassId : undefined,
      subclassSelectionLevel:
        record.category === 'BASE' ? record.subclassSelectionLevel : undefined,
      description: record.description,
      hitpoint: record.category === 'BASE' ? record.hitpoint : undefined,
      requirementGroups:
        record.category === 'BASE' ? record.multiclass.requirementGroups : undefined
    })),
    backgrounds: input.backgrounds.map((record) => ({
      id: record.id,
      label: record.label,
      description: record.description,
      summary: record.description ?? '',
      grantFacts: [],
      featureLabels: (record.features ?? []).slice(0, 2).map((feature) => feature.label),
      hiddenGrantFactCount: 0,
      hiddenFeatureCount: Math.max(0, (record.features?.length ?? 0) - 2)
    })),
    equipment: input.equipment.map(
      (record): CharacterBuilderEquipmentCatalogRecord => ({
        id: record.id,
        label: record.label,
        category: record.category,
        isContainer: Boolean(record.capacity),
        maxStack: record.maxStack,
        properties: [...record.properties],
        requiresAttunement: record.requiresAttunement ?? false
      })
    ),
    feats: (input.feats ?? []).map((record) => ({ id: record.id, label: record.label })),
    spells: input.spells.map((record) => ({
      id: record.id,
      label: record.label,
      attributes: record.attributes,
      castingTime: record.castingTime,
      classIds: record.classIds,
      components: record.components,
      description: record.description,
      level: record.level,
      magicSchoolId: record.magicSchoolId,
      materialDescription: record.materialDescription
    }))
  }
}

function createExactPresentation(input: {
  character: CharacterAuthored
  registry: CharacterBuilderRegistry
}): Pick<CharacterBuilderResolution, 'grants' | 'summary'> {
  const {
    classSelections,
    totalLevel,
    baseRace,
    selectedRace,
    selectedBackground,
    selectedAncestryOption,
    grantedFeatures
  } = collectGrantedFeaturesForCharacter(input.character, input.registry)
  const grants: CharacterBuilderGrantedContent = {
    features: grantedFeatures.map((record) => ({
      id: record.feature.id,
      label: record.feature.label,
      description: record.feature.description,
      sortOrder: record.feature.order,
      availableAtLevel: record.feature.availableAtLevel,
      attributes: record.feature.attributes,
      sourceLabel: record.sourceLabel,
      source: record.source
    })),
    resources: classSelections.flatMap((selection) => {
      const source = selection.baseClass?.resources
      const subclass = selection.subclass
      const subclassSource = subclass?.resources
      return [
        ...(source && source.availableAtLevel <= selection.row.classLevel
          ? [
              {
                id: source.id,
                label: source.label,
                description: source.description,
                sortOrder: source.order,
                availableAtLevel: source.availableAtLevel,
                sourceLabel: selection.baseClass?.label ?? 'Class',
                source: {
                  kind: 'CLASS' as const,
                  classId: selection.row.classId,
                  classLevel: selection.row.classLevel
                }
              }
            ]
          : []),
        ...(subclassSource && subclassSource.availableAtLevel <= selection.row.classLevel
          ? [
              {
                id: subclassSource.id,
                label: subclassSource.label,
                description: subclassSource.description,
                sortOrder: subclassSource.order,
                availableAtLevel: subclassSource.availableAtLevel,
                sourceLabel: subclass?.label ?? 'Subclass',
                source: {
                  kind: 'SUBCLASS' as const,
                  subclassId: subclass.id,
                  classLevel: selection.row.classLevel
                }
              }
            ]
          : [])
      ]
    }),
    spellcasting: classSelections.flatMap((selection) => {
      const source = selection.baseClass?.spellcasting
      const subclass = selection.subclass
      const subclassSource = subclass?.spellcasting
      return [
        ...(source && (source.availableAtLevel ?? 1) <= selection.row.classLevel
          ? [
              {
                id: `${selection.baseClass?.id}:spellcasting`,
                label: source.magicName ?? 'Spellcasting',
                details: source.details
                  ?.slice()
                  .sort((left, right) => left.order - right.order)
                  .map((detail) => ({
                    id: detail.id,
                    label: detail.label,
                    description: detail.description
                  })),
                sortOrder: source.order,
                availableAtLevel: source.availableAtLevel ?? 1,
                sourceLabel: selection.baseClass?.label ?? 'Class',
                source: {
                  kind: 'CLASS' as const,
                  classId: selection.row.classId,
                  classLevel: selection.row.classLevel
                }
              }
            ]
          : []),
        ...(subclassSource && (subclassSource.availableAtLevel ?? 1) <= selection.row.classLevel
          ? [
              {
                id: `${selection.subclass?.id}:spellcasting`,
                label: subclassSource.magicName ?? 'Spellcasting',
                details: subclassSource.details
                  ?.slice()
                  .sort((left, right) => left.order - right.order)
                  .map((detail) => ({
                    id: detail.id,
                    label: detail.label,
                    description: detail.description
                  })),
                sortOrder: subclassSource.order,
                availableAtLevel: subclassSource.availableAtLevel ?? 1,
                sourceLabel: subclass?.label ?? 'Subclass',
                source: {
                  kind: 'SUBCLASS' as const,
                  subclassId: subclass.id,
                  classLevel: selection.row.classLevel
                }
              }
            ]
          : [])
      ]
    })
  }
  const summary: CharacterBuilderSummary = {
    totalLevel,
    abilities: deriveAbilityScores(input.character.intent.abilities),
    selectedRace: selectedRace
      ? {
          raceId: baseRace?.id ?? selectedRace.id,
          raceLabel: baseRace?.label ?? selectedRace.label,
          subraceId: selectedRace.category === RACE_CATEGORY_CODE.SUBRACE ? selectedRace.id : undefined,
          subraceLabel:
            selectedRace.category === RACE_CATEGORY_CODE.SUBRACE ? selectedRace.label : undefined,
          ancestryId: selectedRace.ancestry?.id,
          ancestryLabel: selectedRace.ancestry?.label,
          ancestryOptionId: selectedAncestryOption?.id,
          ancestryOptionLabel: selectedAncestryOption?.label
        }
      : undefined,
    selectedBackground: selectedBackground
      ? { backgroundId: selectedBackground.id, label: selectedBackground.label }
      : undefined,
    classes: classSelections.map((selection) => ({
      classId: selection.row.classId,
      classLabel: selection.baseClass?.label ?? 'Unknown Class',
      classLevel: selection.row.classLevel,
      subclassId: selection.row.subclassId,
      subclassLabel: selection.subclass?.label,
      specializationId: selection.row.specializationId,
      specializationLabel: selection.subclass?.specializations?.find(
        (record) => record.id === selection.row.specializationId
      )?.label,
      featureLabels: selection.features.map((feature) => feature.label),
      resourceLabels: selection.resources.map((resource) => resource.label),
      spellcastingLabels: selection.spellcasting.map(
        (spellcasting) => spellcasting.magicName ?? 'Spellcasting'
      )
    }))
  }
  return { grants, summary }
}

export function createCharacterCommittedSheetResolution(input: {
  character: CharacterAuthored
  sources: CharacterCommittedSheetSources
}): CharacterBuilderResolution {
  const registry = createExactBuilderRegistry(input.sources)
  const documents = documentsFromRecords(input.sources.recordsByRoot)
  const catalog = createExactCatalog({ ...registry, spells: documents.spells })
  const presentation = createExactPresentation({ character: input.character, registry })
  return {
    mode: 'edit',
    catalog,
    registry,
    sourceRegistry: registry,
    ...presentation,
    chosenGrantChoices: [],
    outstandingChoices: [],
    validations: [],
    readiness: { ready: true, blockingIssues: [], outstandingRequiredChoices: [] },
    recommendedSectionId: 'REVIEW'
  }
}

export function createCharacterCommittedSheetExtras(input: {
  character: CharacterAuthored
  sources: CharacterCommittedSheetSources
}): {
  creaturesById: ReadonlyMap<string, CreatureAuthored>
  vehiclesById: ReadonlyMap<string, VehicleAuthored>
} {
  const documents = documentsFromRecords(input.sources.recordsByRoot)
  const creaturesById = new Map(documents.creatures.map((creature) => [creature.id, creature]))
  const vehiclesById = new Map(documents.vehicles.map((vehicle) => [vehicle.id, vehicle]))
  for (const instance of input.character.state.creatures ?? []) {
    if (!creaturesById.has(instance.creatureId)) {
      throw new CharacterCommittedSheetSourcesError(
        `Character "${input.character.id}" is missing exact Creature "${instance.creatureId}".`
      )
    }
  }
  for (const instance of input.character.state.vehicles ?? []) {
    if (!vehiclesById.has(instance.vehicleId)) {
      throw new CharacterCommittedSheetSourcesError(
        `Character "${input.character.id}" is missing exact Vehicle "${instance.vehicleId}".`
      )
    }
  }
  return { creaturesById, vehiclesById }
}

export function createCharacterCommittedSheetSpells(
  sources: CharacterCommittedSheetSources
): ReadonlyMap<string, SpellAuthored> {
  return new Map(documentsFromRecords(sources.recordsByRoot).spells.map((spell) => [spell.id, spell]))
}

export async function loadCharacterCommittedSheetSources(input: {
  db: DBLike
  mechanics: CharacterCommittedSheetSourceIdentity
}): Promise<CharacterCommittedSheetSources> {
  const authoredRepository = createAuthoredVersionRepository(input.db)
  const vocabularyRepository = createSystemVocabularySnapshotRepository(input.db)
  const [recordsByVersionId, vocabularySnapshot] = await Promise.all([
    authoredRepository.findExactVersions({
      entries: input.mechanics.authoredVersionVector,
      verifyCompiledDependencies: false
    }),
    vocabularyRepository.findById(input.mechanics.systemVocabularySnapshotId)
  ])
  const recordsByRoot = new Map<string, AuthoredVersionRecord>()
  for (const record of recordsByVersionId.values()) {
    const key = authoredRootKey(record.authored)
    if (recordsByRoot.has(key)) {
      throw new CharacterCommittedSheetSourcesError(
        `Character "${input.mechanics.characterId}" resolved duplicate authored dependency "${key}".`
      )
    }
    recordsByRoot.set(key, record)
  }

  const sourceIdentity = {
    mechanics: input.mechanics,
    recordsByRoot,
    vocabularySnapshot
  }
  assertCharacterCommittedSheetSourceIdentity(sourceIdentity)

  return {
    mechanics: input.mechanics,
    recordsByRoot,
    vocabularySnapshot: sourceIdentity.vocabularySnapshot
  }
}
