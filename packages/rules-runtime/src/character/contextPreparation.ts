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
import { compileFeature, type CompiledFeature } from '@artificer-toolkit/shared/compilers'
import {
  compileBackground,
  compileClass,
  compileFeat,
  compileRace,
  compileResolvedEquipment,
  resolveEquipmentAuthored,
  resolveRaceAuthored,
  compileSpell,
  type CompiledClass,
  type CompiledEquipment,
  type CompiledSpell,
  type ResolvedEquipment,
  type ResolvedRace
} from '@artificer-toolkit/shared/subjects/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { ContentSnapshotIndexEntry } from '@artificer-toolkit/schema/api/contentSnapshots'

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
import {
  createCharacterBuilderCatalog,
  toCharacterBuilderEquipmentCatalogRecord,
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
  /**
   * Complete authorized picker facts and only readable referenced mechanics. Referenced ids may
   * also name non-Spell targets.
   */
  readSpellCatalogue(referencedSpellIds: ReadonlySet<string>): Promise<{
    entries: readonly ContentSnapshotIndexEntry<'SPELL'>[]
    documents: readonly SpellAuthoredDto[]
  }>
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

/**
 * Selected authored roots split into their compiled rule records and the by-id prose lookup the
 * views read (D163). `features` are the wanted Features beyond those the roots own.
 */
export function compileCharacterRuleSources(roots: {
  races: readonly ResolvedRace[]
  classes: readonly ClassAuthored[]
  backgrounds: readonly BackgroundAuthored[]
  equipment: readonly ResolvedEquipment[]
  feats: readonly FeatAuthored[]
  features: readonly FeatureAuthored[]
}) {
  const { races, classes, backgrounds, equipment, feats, features } = roots
  const presentation: CharacterPresentationLookup = {
    races: Object.fromEntries(races.map((record) => [record.id, record])),
    classes: Object.fromEntries(classes.map((record) => [record.id, record])),
    backgrounds: Object.fromEntries(backgrounds.map((record) => [record.id, record])),
    feats: Object.fromEntries(feats.map((record) => [record.id, record])),
    features: Object.fromEntries(
      [...races, ...classes, ...backgrounds, ...equipment, ...feats]
        .flatMap((root) => (root.features ?? []) as FeatureAuthored[])
        .concat(
          races.flatMap(
            (race) => race.ancestry?.options.flatMap((option) => option.features ?? []) ?? []
          ),
          features
        )
        .map((record) => [record.id, record])
    ),
    equipment: Object.fromEntries(equipment.map((record) => [record.id, record]))
  }
  return {
    compiled: {
      races: races.map(compileRace),
      classes: classes.map(compileClass),
      backgrounds: backgrounds.map(compileBackground),
      equipment: equipment.map(compileResolvedEquipment),
      feats: feats.map(compileFeat),
      features: features.map(compileFeature)
    },
    presentation
  }
}

/** A compiled Feature's rules identity; compiler output leaves absent fields `undefined`. */
function compiledFeatureChecksum(feature: CompiledFeature) {
  return checksumRuleDocument(JSON.parse(JSON.stringify(feature)))
}

/** A current authorized Spell compiled for the rules; a Spell of another System never joins. */
export function compileCharacterRuleSpell(
  character: Pick<CharacterAuthored, 'systemId'>,
  spell: SpellAuthored
) {
  if (spell.systemId !== character.systemId)
    throw new Error(`Character rule evaluation could not hydrate spell "${spell.id}".`)
  return compileSpell(spell)
}

/** Prepare current mechanics; catalogue reuse is limited to the same authorized transaction. */
export async function prepareCharacterRuleContext(
  character: CharacterAuthored,
  system: SystemAuthoredDto,
  previousSpellCatalogue:
    | {
        spellCatalogueEntries: readonly ContentSnapshotIndexEntry<'SPELL'>[]
        currentSpellDocumentsById: ReadonlyMap<string, SpellAuthored>
      }
    | undefined,
  readers: CharacterRuleContextReaders
) {
  const selected = collectCharacterRuleSourceSelections(character)

  const races: ResolvedRace[] = []
  const classes: ClassAuthored[] = []
  const backgrounds: BackgroundAuthored[] = []
  const equipment: ResolvedEquipment[] = []
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
  const retainedSpellsById = new Map<string, CompiledSpell>()
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
          if (!retainedEquipmentById.has(id)) retainedEquipmentById.set(id, retained)
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

  // A companion Creature's armor class is computed from its loadout Equipment (D107).
  // A plain record: the registry crosses Convex value boundaries, which cannot hold a Map.
  const creatureLoadoutEquipmentById: Record<string, CompiledEquipment> = {}
  for (const creature of creaturesById.values()) {
    for (const { equipmentId } of creature.equipmentLoadout ?? []) {
      if (equipmentId in creatureLoadoutEquipmentById) continue
      const published = await readers.readPublication(equipmentId)
      if (published?.subjectKind !== 'EQUIPMENT')
        throw new Error('A companion Creature loadout Equipment is unavailable.')
      const ancestors = await readers.readEquipmentParents(published.document)
      creatureLoadoutEquipmentById[equipmentId] = compileResolvedEquipment(
        resolveEquipmentAuthored(
          published.document as EquipmentAuthored,
          (id) => ancestors.get(id) as EquipmentAuthored | undefined
        )
      )
    }
  }

  const wantedFeatures = new Set(character.intent.featureAcquisitions.map((row) => row.featureId))
  const features = new Map<string, FeatureAuthored>()
  function addFeatures(records: readonly FeatureAuthored[]) {
    for (const feature of records) {
      if (!wantedFeatures.has(feature.id)) continue
      const previous = features.get(feature.id)
      // Rules identity: two owners may word one feature differently, never compile it differently.
      if (
        previous &&
        compiledFeatureChecksum(compileFeature(previous)) !==
          compiledFeatureChecksum(compileFeature(feature))
      )
        throw new Error('Current Character feature identity is ambiguous.')
      if (!previous) features.set(feature.id, feature)
    }
  }
  for (const root of [...races, ...classes, ...backgrounds, ...equipment, ...feats])
    addFeatures((root.features ?? []) as FeatureAuthored[])
  for (const race of races)
    addFeatures(race.ancestry?.options.flatMap((option) => option.features ?? []) ?? [])

  // Pinned acquired Equipment carries its Features compiled; they hydrate as they are (D163).
  const retainedFeatures = [...retainedEquipmentById.values()]
    .flatMap(({ equipment }) => equipment.features ?? [])
    .filter((feature) => wantedFeatures.has(feature.id))
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
      if ('features' in published.document)
        addFeatures((published.document.features ?? []) as FeatureAuthored[])
      if (published.subjectKind === 'RACE' && published.document.category === 'BASE')
        addFeatures(
          (published.document.ancestry?.options.flatMap((option) => option.features ?? []) ??
            []) as FeatureAuthored[]
        )
    }
  }

  const { compiled, presentation } = compileCharacterRuleSources({
    races,
    classes,
    backgrounds,
    equipment,
    feats,
    features: [...features.values()]
  })
  const pinnedEquipment = [...retainedEquipmentById.values()].filter(
    ({ equipment }) => !compiled.equipment.some((record) => record.id === equipment.id)
  )
  compiled.equipment.push(...pinnedEquipment.map(({ equipment }) => equipment))
  for (const feature of retainedFeatures) {
    const previous = compiled.features.find((record) => record.id === feature.id)
    if (previous && compiledFeatureChecksum(previous) !== compiledFeatureChecksum(feature))
      throw new Error('Current Character feature identity is ambiguous.')
    if (!previous) compiled.features.push(feature)
  }
  const context = {
    registry: {
      system,
      ...compiled,
      acquiredEquipmentByItemId,
      creatureLoadoutEquipmentById
    },
    presentation: {
      ...presentation,
      equipment: {
        ...presentation.equipment,
        ...Object.fromEntries(
          pinnedEquipment.map((pinned) => [pinned.equipment.id, pinned.presentation])
        )
      }
    },
    catalog: { spells: [] as CharacterRuleContext['catalog']['spells'] },
    vocabularySnapshot: { document: system }
  } satisfies CharacterRuleContext
  const needsSpellCatalog = needsCharacterSpellCatalog(character, context.registry)
  const currentSpellDocumentsById =
    needsSpellCatalog && previousSpellCatalogue
      ? new Map(previousSpellCatalogue.currentSpellDocumentsById)
      : new Map<string, SpellAuthored>()
  let spellCatalogueEntries: readonly ContentSnapshotIndexEntry<'SPELL'>[] = []
  if (needsSpellCatalog) {
    if (previousSpellCatalogue) spellCatalogueEntries = previousSpellCatalogue.spellCatalogueEntries
    const referencedSpellIds = collectCharacterReferencedSpellIds(character, context)
    if (
      !previousSpellCatalogue ||
      spellCatalogueEntries.some(
        (entry) => referencedSpellIds.has(entry.id) && !currentSpellDocumentsById.has(entry.id)
      )
    ) {
      const catalogue = await readers.readSpellCatalogue(referencedSpellIds)
      spellCatalogueEntries = catalogue.entries
      for (const spell of catalogue.documents)
        currentSpellDocumentsById.set(spell.id, spell as SpellAuthored)
    }
    context.catalog.spells = [...spellCatalogueEntries]
      .map(({ id, label, level, classIds }) => ({ id, label, level, classIds }))
      .sort(
        (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
      )
  }
  const spellsById = new Map(
    [...currentSpellDocumentsById].map(
      ([id, spell]) => [id, compileCharacterRuleSpell(character, spell)] as const
    )
  )
  for (const [id, spell] of retainedSpellsById) if (!spellsById.has(id)) spellsById.set(id, spell)
  return {
    ...context,
    spellsById,
    currentSpellDocumentsById,
    spellCatalogueEntries,
    creaturesById,
    vehiclesById,
    /** Picker facts of the selected roots, so a catalogue over them needs no authored record. */
    catalogSources: {
      races: races.map(toCharacterBuilderRaceCatalogSource),
      classes: classes.map(toClassSource),
      backgrounds: backgrounds.map(toBackgroundSource)
    }
  }
}

type PreparedCharacterRuleContext = Awaited<ReturnType<typeof prepareCharacterRuleContext>>

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
const toBackgroundSource = (document: BackgroundAuthored) =>
  toContentSnapshotIndexEntry({
    subjectKind: 'BACKGROUND',
    document: document as BackgroundAuthoredDto
  })

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
    matches: (spell: SpellAuthoredDto) => boolean
  ): Promise<SpellAuthoredDto | null>
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
  const idsOf = (kind: AuthoredPublicationDocument['subjectKind']) =>
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
    ...context,
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
