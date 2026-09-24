import type { AuthoredPublicationDocument } from '@artificer-toolkit/schema/api/authoredPublication'
import type { SubclassAuthoredDto } from '@artificer-toolkit/schema/subjects/class'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type {
  BaseRaceAuthoredDto,
  SubraceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
import type { SpellAuthoredDto } from '@artificer-toolkit/schema/subjects/spell'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
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
import {
  resolveEquipmentAuthored,
  resolveRaceAuthored,
  type ResolvedEquipment,
  type ResolvedRace
} from '@artificer-toolkit/shared/subjects/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { readAcquiredEquipmentRules } from './acquiredEquipmentRules.js'
import { needsCharacterSpellCatalog } from './characterContextSpells.js'
import type { CharacterRuleContext } from './characterRuleContext.js'
import {
  createCharacterBuilderCatalog,
  toCharacterBuilderSpellCatalogRecord
} from './builderCatalog.js'

type Readers = {
  readPublication(id: string): Promise<AuthoredPublicationDocument | null>
  readRaceParent(document: SubraceAuthoredDto): Promise<BaseRaceAuthoredDto>
  requireClassParent(document: SubclassAuthoredDto): Promise<void>
  readEquipmentParents(
    document: EquipmentAuthoredDto
  ): Promise<ReadonlyMap<string, EquipmentAuthoredDto>>
  readFeatureSources(
    missingFeatureIds: ReadonlySet<string>
  ): Promise<readonly AuthoredPublicationDocument[]>
  readSpellCatalogue(): Promise<readonly SpellAuthoredDto[]>
}

/** Shared by source batching and context assembly so their required roots cannot diverge. */
export function collectCharacterRuleSourceSelections(character: CharacterAuthored) {
  const selected = new Map<string, Set<AuthoredPublicationDocument['subjectKind']>>()
  function select(
    kind: AuthoredPublicationDocument['subjectKind'],
    ids: readonly (string | undefined)[]
  ) {
    for (const id of ids) {
      if (!id) continue
      const kinds = selected.get(id) ?? new Set<AuthoredPublicationDocument['subjectKind']>()
      kinds.add(kind)
      selected.set(id, kinds)
    }
  }
  select('RACE', [character.intent.race.raceId, character.intent.race.subraceId])
  select(
    'CLASS',
    character.intent.classes.flatMap((row) => [row.classId, row.subclassId])
  )
  select('BACKGROUND', [character.intent.background.backgroundId])
  const chosenIds = (character.intent.chosenGrantSelections ?? []).flatMap((row) => row.targetIds)
  select('EQUIPMENT', [
    ...character.state.equipment.inventory.map((item) => item.equipmentId),
    ...[character.intent.startingEquipment?.class, character.intent.startingEquipment?.background]
      .flatMap((decision) => decision?.groups ?? [])
      .flatMap((group) => group.selections ?? [])
      .map((selection) => selection.equipmentId),
    ...chosenIds
  ])
  select('FEAT', [
    ...character.intent.featureAcquisitions.flatMap((row) =>
      row.source.kind === 'FEAT' ? [row.source.featId] : []
    ),
    ...chosenIds
  ])
  select(
    'CREATURE',
    (character.state.creatures ?? []).map((instance) => instance.creatureId)
  )
  select(
    'VEHICLE',
    (character.state.vehicles ?? []).map((instance) => instance.vehicleId)
  )
  if (selected.size > 500)
    throw new Error('Character selected sources exceed the bounded catalogue limit.')

  return selected
}

/** Prepare Character mechanics from already-authorized current publications. */
export async function prepareCharacterRuleContext(
  character: CharacterAuthored,
  system: SystemAuthoredDto,
  previousSpellDocumentsById: ReadonlyMap<string, SpellAuthored> | undefined,
  readers: Readers
) {
  const selected = collectCharacterRuleSourceSelections(character)

  const races: ResolvedRace[] = []
  const classes: ClassAuthored[] = []
  const backgrounds: BackgroundAuthored[] = []
  const equipment: ResolvedEquipment[] = []
  const acquiredEquipmentByItemId = new Map<
    string,
    { equipment: ResolvedEquipment; versionId: string }
  >()
  const retainedRulesByItemId = new Map(
    character.state.equipment.inventory.flatMap((item) =>
      item.retainedRulesJson
        ? [
            [
              item.id,
              readAcquiredEquipmentRules(
                item.retainedRulesJson,
                item.equipmentId,
                character.systemId
              )
            ] as const
          ]
        : []
    )
  )
  const retainedSpellsById = new Map<string, SpellAuthored>()
  const feats: FeatAuthored[] = []
  const creaturesById = new Map<string, CreatureAuthored>()
  const vehiclesById = new Map<string, VehicleAuthored>()
  for (const [id, kinds] of selected) {
    const published = await readers.readPublication(id)
    if (!published || !kinds.has(published.subjectKind)) {
      if (kinds.has('EQUIPMENT')) {
        for (const item of character.state.equipment.inventory.filter(
          (item) => item.equipmentId === id
        )) {
          const retained = retainedRulesByItemId.get(item.id)
          if (!retained) continue
          const leaf = retained.sources.find(
            (source) => source.subjectKind === 'EQUIPMENT' && source.subjectId === id
          )
          if (!leaf) throw new Error('Acquired Equipment root identity is missing.')
          acquiredEquipmentByItemId.set(item.id, {
            equipment: retained.equipment,
            versionId: leaf.versionId
          })
          if (!equipment.some((record) => record.id === id)) equipment.push(retained.equipment)
          for (const [spellId, spell] of retained.spellsById) retainedSpellsById.set(spellId, spell)
        }
      }
      continue
    }
    // DTO charge refinements do not express CLASS_LEVEL narrowing in inferred TS types.
    // Bridge only after current-document schema and provenance validation above.
    switch (published.subjectKind) {
      case 'RACE': {
        const parent =
          published.document.category === 'SUBRACE'
            ? await readers.readRaceParent(published.document)
            : undefined
        races.push(
          resolveRaceAuthored(
            published.document as RaceAuthored,
            (id) => (id === parent?.id ? parent : undefined) as RaceAuthored | undefined
          )
        )
        break
      }
      case 'CLASS':
        if (published.document.category === 'SUBCLASS')
          await readers.requireClassParent(published.document)
        classes.push(published.document as ClassAuthored)
        break
      case 'BACKGROUND':
        backgrounds.push(published.document as BackgroundAuthored)
        break
      case 'EQUIPMENT': {
        const ancestors = await readers.readEquipmentParents(published.document)
        equipment.push(
          resolveEquipmentAuthored(
            published.document as EquipmentAuthored,
            (id) => ancestors.get(id) as EquipmentAuthored | undefined
          )
        )
        break
      }
      case 'FEAT':
        feats.push(published.document as FeatAuthored)
        break
      case 'CREATURE':
        creaturesById.set(id, published.document as CreatureAuthored)
        break
      case 'VEHICLE':
        vehiclesById.set(id, published.document as VehicleAuthored)
        break
    }
  }

  const wantedFeatures = new Set(character.intent.featureAcquisitions.map((row) => row.featureId))
  const features = new Map<string, FeatureAuthored>()
  function addFeatures(records: readonly FeatureAuthored[]) {
    for (const feature of records) {
      if (!wantedFeatures.has(feature.id)) continue
      const previous = features.get(feature.id)
      if (previous && checksumRuleDocument(previous) !== checksumRuleDocument(feature))
        throw new Error('Current Character feature identity is ambiguous.')
      features.set(feature.id, feature)
    }
  }
  for (const root of [...races, ...classes, ...backgrounds, ...equipment, ...feats])
    addFeatures((root.features ?? []) as FeatureAuthored[])
  for (const race of races)
    addFeatures(race.ancestry?.options.flatMap((option) => option.features ?? []) ?? [])

  const missingFeatures = new Set(
    [...wantedFeatures].filter((id) => !features.has(id) && !feats.some((feat) => feat.id === id))
  )
  if (missingFeatures.size) {
    for (const published of await readers.readFeatureSources(missingFeatures)) {
      if ('features' in published.document)
        addFeatures((published.document.features ?? []) as FeatureAuthored[])
      if (published.subjectKind === 'RACE' && published.document.category === 'BASE')
        addFeatures(
          (published.document.ancestry?.options.flatMap((option) => option.features ?? []) ??
            []) as FeatureAuthored[]
        )
    }
  }

  const context = {
    registry: {
      system,
      races,
      classes,
      backgrounds,
      equipment,
      acquiredEquipmentByItemId,
      feats,
      features: [...features.values()]
    },
    catalog: { spells: [] as CharacterRuleContext['catalog']['spells'] },
    vocabularySnapshot: { document: system }
  } satisfies CharacterRuleContext
  const needsSpellCatalog = needsCharacterSpellCatalog(character, context.registry)
  const spellDocumentsById =
    needsSpellCatalog && previousSpellDocumentsById
      ? new Map(previousSpellDocumentsById)
      : new Map<string, SpellAuthored>()
  if (needsSpellCatalog) {
    if (!previousSpellDocumentsById) {
      for (const spell of await readers.readSpellCatalogue())
        spellDocumentsById.set(spell.id, spell as SpellAuthored)
    }
    context.catalog.spells = [...spellDocumentsById.values()]
      .map(({ id, label, level, classIds }) => ({ id, label, level, classIds }))
      .sort(
        (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
      )
  }
  const currentSpellDocumentsById = new Map(spellDocumentsById)
  for (const [id, spell] of retainedSpellsById)
    if (!spellDocumentsById.has(id)) spellDocumentsById.set(id, spell)
  return {
    ...context,
    spellDocumentsById,
    currentSpellDocumentsById,
    creaturesById,
    vehiclesById
  }
}

/** Active Sheets need current selections and the complete eligible Class/Spell catalogues. */
export async function prepareActiveCharacterBuilderContext<
  TContext extends Awaited<ReturnType<typeof prepareCharacterRuleContext>>
>(
  character: CharacterAuthored,
  context: TContext,
  readClassCatalogue: () => Promise<readonly ClassAuthored[]>
) {
  const classes = new Map(context.registry.classes.map((record) => [record.id, record]))
  if (
    character.intent.classes.some((selection) =>
      context.registry.classes.some(
        (record) =>
          record.id === selection.classId &&
          record.category === 'BASE' &&
          record.subclassSelectionLevel !== undefined &&
          selection.classLevel >= record.subclassSelectionLevel
      )
    )
  ) {
    for (const record of await readClassCatalogue()) classes.set(record.id, record)
  }
  for (const record of classes.values()) {
    if (record.category === 'SUBCLASS' && classes.get(record.parentClassId)?.category !== 'BASE')
      throw new Error('A readable base class in the same System is required.')
  }
  return {
    ...context,
    catalog: createCharacterBuilderCatalog({
      system: context.registry.system,
      races: [...context.registry.races],
      classes: [...classes.values()],
      backgrounds: [...context.registry.backgrounds],
      equipment: [...context.registry.equipment].sort(
        (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
      ),
      feats: (context.registry.feats ?? [])
        .map(({ id, label }) => ({ id, label }))
        .sort(
          (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
        ),
      spells: [...context.currentSpellDocumentsById.values()]
        .sort(
          (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
        )
        .map(toCharacterBuilderSpellCatalogRecord)
    })
  }
}
