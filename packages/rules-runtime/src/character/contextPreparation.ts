import type {
  AuthoredPublicationDocument,
  AuthoredStoredCompilation
} from '@artificer-toolkit/schema/api/authoredPublication'
import type { AcquiredPresentation } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import type { ClassAuthoredDto } from '@artificer-toolkit/schema/subjects/class'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { BaseRaceAuthoredDto } from '@artificer-toolkit/schema/subjects/race'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { CompiledFeature } from '@artificer-toolkit/shared/compilers'
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
  type CompiledBackground,
  type CompiledClass,
  type CompiledCreature,
  type CompiledEquipment,
  type CompiledFeat,
  type CompiledRace,
  type CompiledSpell,
  type CompiledVehicle,
  type ResolvedEquipment,
  type ResolvedRace
} from '@artificer-toolkit/shared/subjects/compilers'

import type { ContentSnapshotIndexEntry } from '@artificer-toolkit/schema/api/contentSnapshots'

import {
  compiledProjectionChecksum,
  hydrateStoredCompilation
} from '../authoredPublicationHydrate.js'
import { toContentSnapshotIndexEntry } from '../contentSnapshots.js'
import { readAcquiredEquipmentRules } from './acquiredEquipmentRules.js'
import { collectContextSpellIds, needsCharacterSpellCatalog } from './characterContextSpells.js'
import type { CharacterPresentationLookup, CharacterRuleContext } from './characterRuleContext.js'
import { getCharacterChosenGrantOwners } from './builderEligibility.js'
import {
  collectCharacterBuilderFeatures,
  collectGrantedFeaturesForCharacter
} from './characterBuilderSelections.js'
import { getChosenGrantWitnessQuestions } from './chosenGrantChoiceResolver.js'
import { publicationFeatures } from './featureSourceHints.js'
import {
  createCharacterBuilderCatalog,
  joinRaceCatalogSource,
  toCharacterBuilderEquipmentCatalogRecord,
  toCharacterBuilderRaceCatalogSource,
  toCharacterBuilderSpellCatalogRecord,
  type CharacterBuilderBackgroundCatalogSource,
  type CharacterBuilderClassCatalogSource,
  type CharacterBuilderEquipmentCatalogRecord,
  type CharacterBuilderFeatCatalogRecord,
  type CharacterBuilderRaceCatalogSource
} from './builderCatalog.js'

type SubjectKind = AuthoredPublicationDocument['subjectKind']

/** The authored record each kind's views read prose from; a subrace or variant is resolved. */
type CharacterPublicationPresentationOf = {
  BACKGROUND: BackgroundAuthored
  CLASS: ClassAuthored
  CREATURE: CreatureAuthored
  EQUIPMENT: ResolvedEquipment
  FEAT: FeatAuthored
  RACE: ResolvedRace
  SPELL: SpellAuthored
  VEHICLE: VehicleAuthored
}

/** The picker facts of the kinds a Builder catalogue lists from the selected roots. */
type CharacterPublicationCatalogSourceOf = {
  BACKGROUND: CharacterBuilderBackgroundCatalogSource
  CLASS: CharacterBuilderClassCatalogSource
  RACE: CharacterBuilderRaceCatalogSource
}

/**
 * A current publication as the engine reads it (D163): the compilation it stored at publish, which
 * hydrates with no compile call. Only view readers supply `presentation`, the authored record
 * views read prose from; commit readers omit it, so no prose reaches readiness or a write.
 */
export type CharacterRulePublication = {
  [Kind in SubjectKind]: {
    subjectKind: Kind
    id: string
    systemId: string
    checksum: string
    compilation: AuthoredStoredCompilation
    presentation?: CharacterPublicationPresentationOf[Kind]
  } & (Kind extends keyof CharacterPublicationCatalogSourceOf
    ? { catalogSource: CharacterPublicationCatalogSourceOf[Kind] }
    : unknown)
}[SubjectKind]

export type CharacterRuleSpellPublication = Extract<
  CharacterRulePublication,
  { subjectKind: 'SPELL' }
>

/**
 * Reads current publications the caller is already authorized to see; unreadable ids are null. A
 * subrace, subclass or Equipment variant is readable only with its whole parent chain.
 */
export type CharacterRuleContextReaders = {
  readPublication(id: string): Promise<CharacterRulePublication | null>
  readFeatureSources(
    missingFeatureIds: ReadonlySet<string>
  ): Promise<readonly CharacterRulePublication[]>
  /**
   * Complete authorized picker facts and only readable referenced mechanics. Referenced ids may
   * also name non-Spell targets.
   */
  readSpellCatalogue(referencedSpellIds: ReadonlySet<string>): Promise<{
    entries: readonly ContentSnapshotIndexEntry<'SPELL'>[]
    publications: readonly CharacterRuleSpellPublication[]
  }>
}

/**
 * A readable current publication as the readers hand it to preparation: its stored compilation,
 * its picker facts and, for view readers, its presentation. A subrace or Equipment variant takes
 * its authorized parent chain, which only its presentation and picker facts resolve against.
 */
export function toCharacterRulePublication(
  published: AuthoredPublicationDocument,
  stored: { checksum: string; compilation: AuthoredStoredCompilation },
  parents: {
    race?: BaseRaceAuthoredDto
    equipment?: ReadonlyMap<string, EquipmentAuthoredDto>
  },
  withPresentation: boolean
): CharacterRulePublication {
  const { id, systemId } = published.document
  const identity = { id, systemId, ...stored }
  // DTO refinements are narrower in the authored types; each document bridges after the
  // publication schema validated it.
  switch (published.subjectKind) {
    case 'RACE': {
      const race = resolveRaceAuthored(published.document as RaceAuthored, (parentId) =>
        parentId === parents.race?.id ? (parents.race as RaceAuthored) : undefined
      )
      return {
        ...identity,
        subjectKind: 'RACE',
        catalogSource: toCharacterBuilderRaceCatalogSource(race),
        ...(withPresentation ? { presentation: race } : {})
      }
    }
    case 'CLASS':
      return {
        ...identity,
        subjectKind: 'CLASS',
        catalogSource: toContentSnapshotIndexEntry(published),
        ...(withPresentation ? { presentation: published.document as ClassAuthored } : {})
      }
    case 'BACKGROUND':
      return {
        ...identity,
        subjectKind: 'BACKGROUND',
        catalogSource: toContentSnapshotIndexEntry(published),
        ...(withPresentation ? { presentation: published.document as BackgroundAuthored } : {})
      }
    case 'EQUIPMENT':
      return {
        ...identity,
        subjectKind: 'EQUIPMENT',
        ...(withPresentation
          ? {
              presentation: resolveEquipmentAuthored(
                published.document as EquipmentAuthored,
                (parentId) => parents.equipment?.get(parentId) as EquipmentAuthored | undefined
              )
            }
          : {})
      }
    case 'FEAT':
      return {
        ...identity,
        subjectKind: 'FEAT',
        ...(withPresentation ? { presentation: published.document as FeatAuthored } : {})
      }
    case 'SPELL':
      return {
        ...identity,
        subjectKind: 'SPELL',
        ...(withPresentation ? { presentation: published.document as SpellAuthored } : {})
      }
    case 'CREATURE':
      return {
        ...identity,
        subjectKind: 'CREATURE',
        ...(withPresentation ? { presentation: published.document as CreatureAuthored } : {})
      }
    case 'VEHICLE':
      return {
        ...identity,
        subjectKind: 'VEHICLE',
        ...(withPresentation ? { presentation: published.document as VehicleAuthored } : {})
      }
  }
}

/**
 * Commit's publication from stored facts alone (D163): the stored compilation and the picker facts
 * the root's catalogue holds. A subrace joins its authorized base Race's facts.
 */
export function toCharacterRuleFactsPublication(
  identity: {
    subjectKind: SubjectKind
    id: string
    systemId: string
    checksum: string
    compilation: AuthoredStoredCompilation
  },
  facts: {
    race?: ContentSnapshotIndexEntry<'RACE'>
    raceParent?: ContentSnapshotIndexEntry<'RACE'>
    class?: ContentSnapshotIndexEntry<'CLASS'>
    background?: ContentSnapshotIndexEntry<'BACKGROUND'>
  }
): CharacterRulePublication {
  const { subjectKind, ...stored } = identity
  const required = <Facts extends { id: string }>(value: Facts | undefined) => {
    if (value?.id !== identity.id)
      throw new Error(`Stored ${subjectKind} picker facts are missing or stale.`)
    return value
  }
  switch (subjectKind) {
    case 'RACE':
      return {
        ...stored,
        subjectKind,
        catalogSource: joinRaceCatalogSource(required(facts.race), facts.raceParent)
      }
    case 'CLASS':
      return { ...stored, subjectKind, catalogSource: required(facts.class) }
    case 'BACKGROUND':
      return { ...stored, subjectKind, catalogSource: required(facts.background) }
    default:
      return { ...stored, subjectKind }
  }
}

/** Spells the Character's selections, state, chosen grants and granted features name. */
export function collectCharacterReferencedSpellIds(
  character: CharacterAuthored,
  context: CharacterRuleContext
): ReadonlySet<string> {
  return new Set([
    ...(character.intent.spellSelections ?? []).flatMap((selection) => selection.spells),
    ...(character.intent.chosenGrantSelections ?? []).flatMap((selection) => selection.targetIds),
    ...(character.state.classes ?? []).flatMap((entry) => [
      ...(entry.spells?.learned ?? []),
      ...(entry.spells?.prepared ?? [])
    ]),
    ...collectContextSpellIds(character, context, undefined)
  ])
}

/** Shared by source batching and context assembly so their required roots cannot diverge. */
function collectCharacterRuleSourceSelections(character: CharacterAuthored) {
  const selected = new Map<string, Set<SubjectKind>>()
  function select(kind: SubjectKind, ids: readonly (string | undefined)[]) {
    for (const id of ids) {
      if (!id) continue
      const kinds = selected.get(id) ?? new Set<SubjectKind>()
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

/** A publication of another System never joins the Character's rules. */
function requireCharacterSystem(
  character: Pick<CharacterAuthored, 'systemId'>,
  publication: CharacterRulePublication
) {
  if (publication.systemId !== character.systemId)
    throw new Error(
      `Character rule evaluation could not hydrate ${publication.subjectKind.toLowerCase()} "${publication.id}".`
    )
}

/** A current authorized Spell's stored compilation, hydrated for the rules. */
export function hydrateCharacterRuleSpell(
  character: Pick<CharacterAuthored, 'systemId'>,
  spell: CharacterRuleSpellPublication
): CompiledSpell {
  requireCharacterSystem(character, spell)
  return hydrateStoredCompilation('SPELL', spell, spell.compilation)
}

/** Every Feature an authored record holds, ancestry options included, for the prose lookup. */
function presentationFeatures(
  record: NonNullable<CharacterRulePublication['presentation']>
): FeatureAuthored[] {
  return [
    ...('features' in record ? ((record.features ?? []) as FeatureAuthored[]) : []),
    ...('ancestry' in record
      ? (record.ancestry?.options.flatMap((option) => option.features ?? []) ?? [])
      : [])
  ]
}

/** Prepare current mechanics; catalogue reuse is limited to the same authorized transaction. */
export async function prepareCharacterRuleContext(
  character: CharacterAuthored,
  system: SystemAuthoredDto,
  previousSpellCatalogue:
    | {
        spellCatalogueEntries: readonly ContentSnapshotIndexEntry<'SPELL'>[]
        currentSpellsById: ReadonlyMap<string, CharacterRuleSpellPublication>
      }
    | undefined,
  readers: CharacterRuleContextReaders
) {
  const selected = collectCharacterRuleSourceSelections(character)

  const read: CharacterRulePublication[] = []
  const races: CompiledRace[] = []
  const classes: CompiledClass[] = []
  const backgrounds: CompiledBackground[] = []
  const equipment: CompiledEquipment[] = []
  const feats: CompiledFeat[] = []
  const catalogSources = {
    races: [] as CharacterBuilderRaceCatalogSource[],
    classes: [] as CharacterBuilderClassCatalogSource[],
    backgrounds: [] as CharacterBuilderBackgroundCatalogSource[]
  }
  const acquiredEquipmentByItemId = new Map<
    string,
    { equipment: CompiledEquipment; versionId: string }
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
  const retainedEquipmentById = new Map<
    string,
    Pick<ReturnType<typeof readAcquiredEquipmentRules>, 'equipment' | 'presentation'>
  >()
  const retainedSpellsById = new Map<
    string,
    { compiled: CompiledSpell; presentation: AcquiredPresentation }
  >()
  const creaturesById = new Map<string, CompiledCreature>()
  const vehiclesById = new Map<string, CompiledVehicle>()
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
          if (!retainedEquipmentById.has(id)) retainedEquipmentById.set(id, retained)
          for (const [spellId, spell] of retained.spellsById) retainedSpellsById.set(spellId, spell)
        }
      }
      continue
    }
    requireCharacterSystem(character, published)
    read.push(published)
    switch (published.subjectKind) {
      case 'RACE':
        races.push(hydrateStoredCompilation('RACE', published, published.compilation))
        catalogSources.races.push(published.catalogSource)
        break
      case 'CLASS':
        classes.push(hydrateStoredCompilation('CLASS', published, published.compilation))
        catalogSources.classes.push(published.catalogSource)
        break
      case 'BACKGROUND':
        backgrounds.push(hydrateStoredCompilation('BACKGROUND', published, published.compilation))
        catalogSources.backgrounds.push(published.catalogSource)
        break
      case 'EQUIPMENT':
        equipment.push(hydrateStoredCompilation('EQUIPMENT', published, published.compilation))
        break
      case 'FEAT':
        feats.push(hydrateStoredCompilation('FEAT', published, published.compilation))
        break
      case 'CREATURE':
        creaturesById.set(
          id,
          hydrateStoredCompilation('CREATURE', published, published.compilation)
        )
        break
      case 'VEHICLE':
        vehiclesById.set(id, hydrateStoredCompilation('VEHICLE', published, published.compilation))
        break
    }
  }

  // A companion Creature's armor class is computed from its loadout Equipment (D107).
  // A plain record: the registry crosses Convex value boundaries, which cannot hold a Map.
  const creatureLoadoutEquipmentById: Record<string, CompiledEquipment> = {}
  for (const creature of creaturesById.values()) {
    for (const { equipmentId } of creature.equipmentLoadout ?? []) {
      if (equipmentId in creatureLoadoutEquipmentById) continue
      const published = await readers.readPublication(equipmentId)
      if (published?.subjectKind !== 'EQUIPMENT')
        throw new Error('A companion Creature loadout Equipment is unavailable.')
      requireCharacterSystem(character, published)
      creatureLoadoutEquipmentById[equipmentId] = hydrateStoredCompilation(
        'EQUIPMENT',
        published,
        published.compilation
      )
    }
  }

  const wantedFeatures = new Set(character.intent.featureAcquisitions.map((row) => row.featureId))
  const features = new Map<string, CompiledFeature>()
  // Rules identity: two owners may word one feature differently, never compile it differently.
  function addFeatures(records: readonly CompiledFeature[]) {
    for (const feature of records) {
      if (!wantedFeatures.has(feature.id)) continue
      const previous = features.get(feature.id)
      if (previous && compiledProjectionChecksum(previous) !== compiledProjectionChecksum(feature))
        throw new Error('Current Character feature identity is ambiguous.')
      if (!previous) features.set(feature.id, feature)
    }
  }
  for (const published of read) addFeatures(publicationFeatures(published))

  // Pinned acquired Equipment carries its Features compiled; they hydrate as they are (D163).
  const retainedFeatures = [...retainedEquipmentById.values()].flatMap(
    ({ equipment }) => equipment.features ?? []
  )
  const featureSources: CharacterRulePublication[] = []
  const missingFeatures = new Set(
    [...wantedFeatures].filter(
      (id) =>
        !features.has(id) &&
        !feats.some((feat) => feat.id === id) &&
        !retainedFeatures.some((feature) => feature.id === id)
    )
  )
  if (missingFeatures.size) {
    for (const published of await readers.readFeatureSources(missingFeatures)) {
      requireCharacterSystem(character, published)
      featureSources.push(published)
      addFeatures(publicationFeatures(published))
    }
  }
  addFeatures(retainedFeatures)

  const pinnedEquipment = [...retainedEquipmentById.values()].filter(
    ({ equipment: pinned }) => !equipment.some((record) => record.id === pinned.id)
  )
  equipment.push(...pinnedEquipment.map((pinned) => pinned.equipment))

  const context = {
    registry: {
      system,
      races,
      classes,
      backgrounds,
      equipment,
      feats,
      features: [...features.values()],
      acquiredEquipmentByItemId,
      creatureLoadoutEquipmentById
    },
    presentation: presentationLookup(
      read,
      featureSources,
      Object.fromEntries(
        pinnedEquipment.map((pinned) => [pinned.equipment.id, pinned.presentation])
      ),
      Object.fromEntries(retainedSpellsById)
    ),
    catalog: { spells: [] as CharacterRuleContext['catalog']['spells'] },
    vocabularySnapshot: { document: system }
  } satisfies CharacterRuleContext
  const needsSpellCatalog = needsCharacterSpellCatalog(character, context.registry)
  const currentSpellsById =
    needsSpellCatalog && previousSpellCatalogue
      ? new Map(previousSpellCatalogue.currentSpellsById)
      : new Map<string, CharacterRuleSpellPublication>()
  let spellCatalogueEntries: readonly ContentSnapshotIndexEntry<'SPELL'>[] = []
  if (needsSpellCatalog) {
    if (previousSpellCatalogue) spellCatalogueEntries = previousSpellCatalogue.spellCatalogueEntries
    const referencedSpellIds = collectCharacterReferencedSpellIds(character, context)
    if (
      !previousSpellCatalogue ||
      spellCatalogueEntries.some(
        (entry) => referencedSpellIds.has(entry.id) && !currentSpellsById.has(entry.id)
      )
    ) {
      const catalogue = await readers.readSpellCatalogue(referencedSpellIds)
      spellCatalogueEntries = catalogue.entries
      for (const spell of catalogue.publications) currentSpellsById.set(spell.id, spell)
    }
    context.catalog.spells = [...spellCatalogueEntries]
      .map(({ id, label, level, classIds, attributes }) => ({
        id,
        label,
        level,
        classIds,
        attributes
      }))
      .sort(
        (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
      )
  }
  const spellsById = new Map(
    [...currentSpellsById].map(
      ([id, spell]) => [id, hydrateCharacterRuleSpell(character, spell)] as const
    )
  )
  for (const [id, { compiled }] of retainedSpellsById)
    if (!spellsById.has(id)) spellsById.set(id, compiled)
  return {
    ...context,
    spellsById,
    currentSpellsById,
    spellCatalogueEntries,
    creaturesById,
    vehiclesById,
    /** Picker facts of the selected roots, so a catalogue over them needs no authored record. */
    catalogSources
  }
}

/**
 * The by-id prose views read (D163), when the readers supplied every record's presentation; commit
 * readers supply none, and a partial lookup would render silent blanks, so it fails closed.
 */
function presentationLookup(
  roots: readonly CharacterRulePublication[],
  featureSources: readonly CharacterRulePublication[],
  pinnedEquipment: CharacterPresentationLookup['equipment'],
  retainedSpells: CharacterPresentationLookup['retainedSpells']
): CharacterPresentationLookup | undefined {
  const supplied = [...roots, ...featureSources].filter(
    (published) => published.presentation !== undefined
  )
  if (supplied.length === 0 && roots.length + featureSources.length > 0) return undefined
  if (supplied.length !== roots.length + featureSources.length)
    throw new Error('Character presentation is incomplete.')
  const of = <Kind extends SubjectKind>(kind: Kind) =>
    Object.fromEntries(
      roots.flatMap((published) =>
        published.subjectKind === kind && published.presentation
          ? [[published.id, published.presentation as CharacterPublicationPresentationOf[Kind]]]
          : []
      )
    )
  return {
    races: of('RACE'),
    classes: of('CLASS'),
    backgrounds: of('BACKGROUND'),
    feats: of('FEAT'),
    creatures: of('CREATURE'),
    vehicles: of('VEHICLE'),
    features: Object.fromEntries(
      [...roots, ...featureSources]
        .flatMap((published) =>
          published.presentation ? presentationFeatures(published.presentation) : []
        )
        .map((record) => [record.id, record])
    ),
    equipment: { ...of('EQUIPMENT'), ...pinnedEquipment },
    retainedSpells
  }
}

type PreparedCharacterRuleContext = Awaited<ReturnType<typeof prepareCharacterRuleContext>>

/** Builder and Sheet views read prose; only commit prepares a context without it (D163). */
export function requireCharacterPresentation<
  TContext extends { presentation?: CharacterPresentationLookup }
>(context: TContext): TContext & { presentation: CharacterPresentationLookup } {
  const { presentation } = context
  if (!presentation) throw new Error('Character presentation is missing.')
  return { ...context, presentation }
}

/**
 * The readable pools the `resolution` scope reads. Each reader applies its own source authority and
 * parent rules, and returns the kind's picker facts; every implementation must agree.
 */
export type CharacterBuilderResolutionCatalogueReaders = {
  readClasses(): Promise<readonly CharacterBuilderClassCatalogSource[]>
  /** Effective projected facts, or the documents to resolve when a stored projection is missing. */
  readEquipment(): Promise<
    | { entries: readonly ContentSnapshotIndexEntry<'EQUIPMENT'>[] }
    | { documents: readonly EquipmentAuthored[] }
  >
  readFeats(): Promise<readonly CharacterBuilderFeatCatalogRecord[]>
}

/** Every picker pool, which the `selectors` scope reads (the browser Builder, ADR 0036 S6). */
export type CharacterBuilderCatalogueReaders = CharacterBuilderResolutionCatalogueReaders & {
  readRaces(): Promise<readonly CharacterBuilderRaceCatalogSource[]>
  readBackgrounds(): Promise<readonly CharacterBuilderBackgroundCatalogSource[]>
}

function byLabel(left: { id: string; label: string }, right: { id: string; label: string }) {
  return left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
}

// Registry documents passed the publication schema; authored refinements narrow its inferred DTO.
const toClassSource = (document: ClassAuthored) =>
  toContentSnapshotIndexEntry({ subjectKind: 'CLASS', document: document as ClassAuthoredDto })
/** The Class pool matters only once a selected Class reaches its subclass level. */
function isSubclassSelectionDue(character: CharacterAuthored, classes: readonly CompiledClass[]) {
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
  return [...context.spellCatalogueEntries].sort(byLabel).map(toCharacterBuilderSpellCatalogRecord)
}

type CharacterEquipmentPool = Awaited<
  ReturnType<CharacterBuilderResolutionCatalogueReaders['readEquipment']>
>

/** Every Equipment parent must be in the same readable pool, without cycles. */
function toEquipmentCatalogRecords(
  pool: CharacterEquipmentPool
): CharacterBuilderEquipmentCatalogRecord[] | ResolvedEquipment[] {
  if ('entries' in pool) {
    const entries = [...pool.entries].sort(byLabel)
    const byId = new Map(entries.map((entry) => [entry.id, entry]))
    const verified = new Set<string>()
    for (const entry of entries) {
      const chain = new Set<string>()
      for (let current = entry; !verified.has(current.id);) {
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
  catalogue:
    | { scope: 'selectors'; readers: CharacterBuilderCatalogueReaders }
    | { scope: 'resolution'; readers: CharacterBuilderResolutionCatalogueReaders }
) {
  const { registry, catalogSources } = context
  const { readers } = catalogue
  const selectors = catalogue.scope === 'selectors'
  const races =
    catalogue.scope === 'selectors'
      ? [...(await catalogue.readers.readRaces())].sort(byLabel)
      : catalogSources.races
  const classes = new Map<string, CharacterBuilderClassCatalogSource>(
    selectors ? [] : catalogSources.classes.map((record) => [record.id, record])
  )
  if (selectors || isSubclassSelectionDue(character, registry.classes))
    for (const record of [...(await readers.readClasses())].sort(byLabel))
      classes.set(record.id, record)
  const backgrounds =
    catalogue.scope === 'selectors'
      ? [...(await catalogue.readers.readBackgrounds())].sort(byLabel)
      : catalogSources.backgrounds
  const equipment = toEquipmentCatalogRecords(await readers.readEquipment())
  const feats = [...(await readers.readFeats())].sort(byLabel)
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

/**
 * Commit's catalogue readers. They read the records a Character references by id, and answer each
 * pool-emptiness question with one readable witness from the complete pool, or none.
 */
type CharacterReferencedCatalogueReaders = {
  /** Readable current Equipment among `ids`, with their parents; unreadable ids are skipped. */
  readEquipment(ids: ReadonlySet<string>): Promise<CharacterEquipmentPool>
  /** Readable current Feats among `ids`; unreadable ids are skipped. */
  readFeats(ids: ReadonlySet<string>): Promise<readonly CharacterBuilderFeatCatalogRecord[]>
  /** A readable subclass of the Class, or null when the complete pool has none. */
  findSubclass(classId: string): Promise<CharacterBuilderClassCatalogSource | null>
  /** The pool of the first readable match (among `candidateIds` when given) and its parents. */
  findEquipment(
    candidateIds: readonly string[] | null,
    matches: (pool: CharacterEquipmentPool, id: string) => boolean
  ): Promise<CharacterEquipmentPool | null>
  findSpell(
    candidateIds: readonly string[] | null,
    matches: (spell: ContentSnapshotIndexEntry<'SPELL'>) => boolean
  ): Promise<ContentSnapshotIndexEntry<'SPELL'> | null>
  findFeat(
    candidateIds: readonly string[] | null,
    matches: (feat: CharacterBuilderFeatCatalogRecord) => boolean
  ): Promise<CharacterBuilderFeatCatalogRecord | null>
}

/**
 * The commit catalogue: the referenced records plus a witness for each pool-emptiness outcome.
 * Every option is monotone in the pool, and every selected id is in both pools, so resolution
 * over this catalogue reaches the complete pool's validations. Two outcomes read emptiness:
 * `SUBCLASS_SELECTION_REQUIRED` (one visible subclass decides it) and the chosen-grant outcomes
 * `getChosenGrantWitnessQuestions` lists.
 */
export async function assembleCharacterReferencedBuilderContext<
  TContext extends PreparedCharacterRuleContext
>(character: CharacterAuthored, context: TContext, readers: CharacterReferencedCatalogueReaders) {
  const { registry, catalogSources } = context
  const selected = collectCharacterRuleSourceSelections(character)
  const idsOf = (kind: SubjectKind) =>
    new Set([...selected].flatMap(([id, kinds]) => (kinds.has(kind) ? [id] : [])))
  const equipment = new Map<string, CharacterBuilderEquipmentCatalogRecord>()
  const addEquipment = (pool: CharacterEquipmentPool | null) => {
    if (!pool) return
    for (const record of toEquipmentCatalogRecords(pool))
      equipment.set(record.id, toCharacterBuilderEquipmentCatalogRecord(record))
  }
  addEquipment(await readers.readEquipment(idsOf('EQUIPMENT')))
  const feats = new Map((await readers.readFeats(idsOf('FEAT'))).map((feat) => [feat.id, feat]))
  const classes = new Map(catalogSources.classes.map((record) => [record.id, record]))
  const spells = new Map(toSpellCatalogRecords(context).map((spell) => [spell.id, spell]))
  const createCatalog = () =>
    createCharacterBuilderCatalog({
      system: registry.system,
      races: catalogSources.races,
      classes: [...classes.values()],
      backgrounds: catalogSources.backgrounds,
      equipment: [...equipment.values()].sort(byLabel),
      feats: [...feats.values()].sort(byLabel),
      spells: [...spells.values()].sort(byLabel)
    })

  for (const row of character.intent.classes) {
    const base = registry.classes.find((record) => record.id === row.classId)
    if (
      row.subclassId ||
      base?.category !== 'BASE' ||
      base.subclassSelectionLevel === undefined ||
      row.classLevel < base.subclassSelectionLevel ||
      [...classes.values()].some(
        (record) => record.category === 'SUBCLASS' && record.parentClassId === row.classId
      )
    )
      continue
    const witness = await readers.findSubclass(row.classId)
    if (witness) classes.set(witness.id, witness)
  }

  const restricted = createCatalog()
  const { classSelections, selectedBackground, grantedFeatures } =
    collectGrantedFeaturesForCharacter(character, registry)
  const owners = getCharacterChosenGrantOwners(
    character,
    classSelections,
    selectedBackground,
    collectCharacterBuilderFeatures(character, registry, grantedFeatures),
    registry.feats ?? []
  )
  const questions = getChosenGrantWitnessQuestions(
    character,
    {
      system: registry.system,
      equipment: restricted.equipment,
      spells: restricted.spells,
      feats: restricted.feats
    },
    owners
  )
  for (const question of questions) {
    switch (question.kind) {
      case 'EQUIPMENT':
        addEquipment(
          await readers.findEquipment(question.candidateIds, (pool, id) => {
            const record = toEquipmentCatalogRecords(pool).find((entry) => entry.id === id)
            return (
              record !== undefined &&
              question.matches(toCharacterBuilderEquipmentCatalogRecord(record))
            )
          })
        )
        break
      case 'SPELL': {
        const witness = await readers.findSpell(question.candidateIds, (spell) =>
          question.matches(toCharacterBuilderSpellCatalogRecord(spell))
        )
        if (witness) spells.set(witness.id, toCharacterBuilderSpellCatalogRecord(witness))
        break
      }
      case 'FEAT': {
        const witness = await readers.findFeat(question.candidateIds, question.matches)
        if (witness) feats.set(witness.id, witness)
        break
      }
    }
  }
  requireSubclassParents(classes)
  return { ...context, catalog: createCatalog() }
}

/** Active Sheets need current selections and the complete eligible Class/Spell catalogues. */
export async function prepareActiveCharacterBuilderContext<
  TContext extends PreparedCharacterRuleContext
>(
  character: CharacterAuthored,
  context: TContext,
  readClassCatalogue: () => Promise<readonly ClassAuthored[]>
) {
  const { registry, catalogSources } = context
  const classes = new Map(catalogSources.classes.map((record) => [record.id, record]))
  if (isSubclassSelectionDue(character, registry.classes)) {
    for (const record of await readClassCatalogue()) classes.set(record.id, toClassSource(record))
  }
  requireSubclassParents(classes)
  return {
    ...requireCharacterPresentation(context),
    catalog: createCharacterBuilderCatalog({
      system: registry.system,
      races: catalogSources.races,
      classes: [...classes.values()],
      backgrounds: catalogSources.backgrounds,
      equipment: registry.equipment.map(toCharacterBuilderEquipmentCatalogRecord).sort(byLabel),
      feats: (registry.feats ?? []).map(({ id, label }) => ({ id, label })).sort(byLabel),
      spells: toSpellCatalogRecords(context)
    })
  }
}
