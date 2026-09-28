import type { AuthoredPublicationDocument } from '@artificer-toolkit/schema/api/authoredPublication'
import type { BackgroundAuthoredDto } from '@artificer-toolkit/schema/subjects/background'
import type {
  ClassAuthoredDto,
  SubclassAuthoredDto
} from '@artificer-toolkit/schema/subjects/class'
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

import type { ContentSnapshotIndexEntry } from '@artificer-toolkit/schema/api/contentSnapshots'

import { toContentSnapshotIndexEntry } from '../contentSnapshots.js'
import { readAcquiredEquipmentRules } from './acquiredEquipmentRules.js'
import { needsCharacterSpellCatalog } from './characterContextSpells.js'
import type { CharacterRuleContext } from './characterRuleContext.js'
import {
  createCharacterBuilderCatalog,
  toCharacterBuilderRaceCatalogSource,
  toCharacterBuilderSpellCatalogRecord,
  type CharacterBuilderBackgroundCatalogSource,
  type CharacterBuilderClassCatalogSource,
  type CharacterBuilderEquipmentCatalogRecord,
  type CharacterBuilderFeatCatalogRecord,
  type CharacterBuilderRaceCatalogSource
} from './builderCatalog.js'

/** Reads current publications the caller is already authorized to see; unreadable ids are null. */
export type CharacterRuleContextReaders = {
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
  readers: CharacterRuleContextReaders
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

type PreparedCharacterRuleContext = Awaited<ReturnType<typeof prepareCharacterRuleContext>>

/**
 * A Character's readable picker pools. Each reader applies its own source authority and parent
 * rules, and returns the kind's picker facts; the Convex and content-snapshot readers must agree.
 */
export type CharacterBuilderCatalogueReaders = {
  readRaces(): Promise<readonly CharacterBuilderRaceCatalogSource[]>
  readClasses(): Promise<readonly CharacterBuilderClassCatalogSource[]>
  readBackgrounds(): Promise<readonly CharacterBuilderBackgroundCatalogSource[]>
  /** Effective projected facts, or the documents to resolve when a stored projection is missing. */
  readEquipment(): Promise<
    | { entries: readonly ContentSnapshotIndexEntry<'EQUIPMENT'>[] }
    | { documents: readonly EquipmentAuthored[] }
  >
  readFeats(): Promise<readonly CharacterBuilderFeatCatalogRecord[]>
}

function byLabel(left: { id: string; label: string }, right: { id: string; label: string }) {
  return left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
}

// Registry documents passed the publication schema; authored refinements narrow its inferred DTO.
const toClassSource = (document: ClassAuthored) =>
  toContentSnapshotIndexEntry({ subjectKind: 'CLASS', document: document as ClassAuthoredDto })
const toBackgroundSource = (document: BackgroundAuthored) =>
  toContentSnapshotIndexEntry({
    subjectKind: 'BACKGROUND',
    document: document as BackgroundAuthoredDto
  })

/** The Class pool matters only once a selected Class reaches its subclass level. */
function isSubclassSelectionDue(character: CharacterAuthored, classes: readonly ClassAuthored[]) {
  return character.intent.classes.some((selection) =>
    classes.some(
      (record) =>
        record.id === selection.classId &&
        record.category === 'BASE' &&
        record.subclassSelectionLevel !== undefined &&
        selection.classLevel >= record.subclassSelectionLevel
    )
  )
}

function requireSubclassParents(classes: ReadonlyMap<string, CharacterBuilderClassCatalogSource>) {
  for (const record of classes.values()) {
    if (record.category === 'SUBCLASS' && classes.get(record.parentClassId)?.category !== 'BASE')
      throw new Error('A readable base class in the same System is required.')
  }
}

function toSpellCatalogRecords(context: PreparedCharacterRuleContext) {
  return [...context.currentSpellDocumentsById.values()]
    .sort(byLabel)
    .map(toCharacterBuilderSpellCatalogRecord)
}

/** Every Equipment parent must be in the same readable pool, without cycles. */
function toEquipmentCatalogRecords(
  pool: Awaited<ReturnType<CharacterBuilderCatalogueReaders['readEquipment']>>
): CharacterBuilderEquipmentCatalogRecord[] | ResolvedEquipment[] {
  if ('entries' in pool) {
    const entries = [...pool.entries].sort(byLabel)
    const byId = new Map(entries.map((entry) => [entry.id, entry]))
    const verified = new Set<string>()
    for (const entry of entries) {
      const chain = new Set<string>()
      for (let current = entry; !verified.has(current.id); ) {
        if (chain.has(current.id)) throw new Error('Equipment variant cycle detected.')
        chain.add(current.id)
        if (current.parentEquipmentId === null) break
        const parent = byId.get(current.parentEquipmentId)
        if (!parent) throw new Error('Readable parent Equipment in the same System is required.')
        current = parent
      }
      for (const id of chain) verified.add(id)
    }
    return entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      category: entry.category,
      isContainer: entry.isContainer,
      ...(entry.maxStack === undefined ? {} : { maxStack: entry.maxStack }),
      properties: [...entry.properties],
      requiresAttunement: entry.requiresAttunement
    }))
  }
  const documents = new Map([...pool.documents].sort(byLabel).map((record) => [record.id, record]))
  const resolved = new Map<string, ResolvedEquipment>()
  const resolving = new Set<string>()
  function resolve(document: EquipmentAuthored): ResolvedEquipment {
    const existing = resolved.get(document.id)
    if (existing) return existing
    if (resolving.has(document.id)) throw new Error('Equipment variant cycle detected.')
    resolving.add(document.id)
    const effective = resolveEquipmentAuthored(document, (parentId) => {
      const parent = documents.get(parentId)
      if (!parent) throw new Error('Readable parent Equipment in the same System is required.')
      return resolve(parent)
    })
    resolving.delete(document.id)
    resolved.set(document.id, effective)
    return effective
  }
  return [...documents.values()].map(resolve)
}

/**
 * The Builder catalogue over a prepared rule context. `selectors` reads every picker pool;
 * `resolution` omits the pools that cannot affect current readiness and reuses current selections.
 */
export async function assembleCharacterBuilderContext<
  TContext extends PreparedCharacterRuleContext
>(
  character: CharacterAuthored,
  context: TContext,
  catalogue: CharacterBuilderCatalogueReaders,
  scope: 'selectors' | 'resolution'
) {
  const { registry } = context
  const selectors = scope === 'selectors'
  const races = selectors
    ? [...(await catalogue.readRaces())].sort(byLabel)
    : registry.races.map(toCharacterBuilderRaceCatalogSource)
  const classes = new Map<string, CharacterBuilderClassCatalogSource>(
    selectors ? [] : registry.classes.map((record) => [record.id, toClassSource(record)])
  )
  if (selectors || isSubclassSelectionDue(character, registry.classes))
    for (const record of [...(await catalogue.readClasses())].sort(byLabel))
      classes.set(record.id, record)
  const backgrounds = selectors
    ? [...(await catalogue.readBackgrounds())].sort(byLabel)
    : registry.backgrounds.map(toBackgroundSource)
  const equipment = toEquipmentCatalogRecords(await catalogue.readEquipment())
  const feats = [...(await catalogue.readFeats())].sort(byLabel)
  requireSubclassParents(classes)
  return {
    ...context,
    catalog: createCharacterBuilderCatalog({
      system: registry.system,
      races,
      classes: [...classes.values()],
      backgrounds,
      equipment,
      feats,
      spells: toSpellCatalogRecords(context)
    })
  }
}

/** Active Sheets need current selections and the complete eligible Class/Spell catalogues. */
export async function prepareActiveCharacterBuilderContext<
  TContext extends PreparedCharacterRuleContext
>(
  character: CharacterAuthored,
  context: TContext,
  readClassCatalogue: () => Promise<readonly ClassAuthored[]>
) {
  const { registry } = context
  const classes = new Map(registry.classes.map((record) => [record.id, toClassSource(record)]))
  if (isSubclassSelectionDue(character, registry.classes)) {
    for (const record of await readClassCatalogue()) classes.set(record.id, toClassSource(record))
  }
  requireSubclassParents(classes)
  return {
    ...context,
    catalog: createCharacterBuilderCatalog({
      system: registry.system,
      races: registry.races.map(toCharacterBuilderRaceCatalogSource),
      classes: [...classes.values()],
      backgrounds: registry.backgrounds.map(toBackgroundSource),
      equipment: [...registry.equipment].sort(byLabel),
      feats: (registry.feats ?? []).map(({ id, label }) => ({ id, label })).sort(byLabel),
      spells: toSpellCatalogRecords(context)
    })
  }
}
