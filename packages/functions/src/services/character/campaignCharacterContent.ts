import {
  createCampaignContentRepository,
  createCampaignRepository,
  createEquipmentRepository,
  createRaceRepository,
  type AuthoredSubjectKind,
  type CampaignCharacterContentBindingInput,
  type CampaignContentVersion,
  type CharacterAssemblyStructureQueryResult,
  type DBLike,
  type Json
} from '@artificer-toolkit/db'
import {
  backgroundAuthoredDtoSchema,
  type BackgroundAuthoredDto
} from '@artificer-toolkit/schema/subjects/background'
import {
  classAuthoredDtoSchema,
  type ClassAuthoredDto
} from '@artificer-toolkit/schema/subjects/class'
import {
  creatureAuthoredDtoSchema,
  type CreatureAuthoredDto
} from '@artificer-toolkit/schema/subjects/creature'
import {
  equipmentAuthoredDtoSchema,
  type EquipmentAuthoredDto
} from '@artificer-toolkit/schema/subjects/equipment'
import {
  featAuthoredDtoSchema,
  type FeatAuthoredDto
} from '@artificer-toolkit/schema/subjects/feat'
import {
  raceAuthoredDtoSchema,
  type RaceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
import {
  spellAuthoredDtoSchema,
  type SpellAuthoredDto
} from '@artificer-toolkit/schema/subjects/spell'
import {
  vehicleAuthoredDtoSchema,
  type VehicleAuthoredDto
} from '@artificer-toolkit/schema/subjects/vehicle'
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
  EquipmentAuthored,
  FeatAuthored,
  RaceAuthored,
  SpellAuthored
} from '@artificer-toolkit/shared/subjects/authored'

type CampaignAuthoredRecord =
  | BackgroundAuthoredDto
  | ClassAuthoredDto
  | CreatureAuthoredDto
  | EquipmentAuthoredDto
  | FeatAuthoredDto
  | RaceAuthoredDto
  | SpellAuthoredDto
  | VehicleAuthoredDto

export interface CampaignAuthoredSnapshot {
  contentVersionId: string
  subjectKind: AuthoredSubjectKind
  subjectId: string
  revision: number
  authored: CampaignAuthoredRecord
}

export interface CampaignCharacterContentOverlay {
  campaignId: string
  bindings: ReadonlyMap<string, CampaignAuthoredSnapshot>
  latest: ReadonlyMap<string, CampaignAuthoredSnapshot>
}

export interface HydratedCampaignBuilderContent {
  backgrounds: BackgroundAuthored[]
  classes: ClassAuthored[]
  equipment: ResolvedEquipment[]
  feats: FeatAuthored[]
  races: ResolvedRace[]
  spells: SpellAuthored[]
}

export function campaignContentRootKey(
  subjectKind: AuthoredSubjectKind,
  subjectId: string
): string {
  return `${subjectKind}:${subjectId}`
}

function parseAuthored(subjectKind: AuthoredSubjectKind, snapshot: Json): CampaignAuthoredRecord {
  switch (subjectKind) {
    case 'BACKGROUND':
      return backgroundAuthoredDtoSchema.parse(snapshot)
    case 'CLASS':
      return classAuthoredDtoSchema.parse(snapshot)
    case 'CREATURE':
      return creatureAuthoredDtoSchema.parse(snapshot)
    case 'EQUIPMENT':
      return equipmentAuthoredDtoSchema.parse(snapshot)
    case 'FEAT':
      return featAuthoredDtoSchema.parse(snapshot)
    case 'RACE':
      return raceAuthoredDtoSchema.parse(snapshot)
    case 'SPELL':
      return spellAuthoredDtoSchema.parse(snapshot)
    case 'VEHICLE':
      return vehicleAuthoredDtoSchema.parse(snapshot)
  }
}

export function parseCampaignAuthoredSnapshot(
  version: Pick<
    CampaignContentVersion,
    'id' | 'revision' | 'snapshot' | 'subjectId' | 'subjectKind'
  >
): CampaignAuthoredSnapshot {
  return {
    contentVersionId: version.id,
    subjectKind: version.subjectKind,
    subjectId: version.subjectId,
    revision: version.revision,
    authored: parseAuthored(version.subjectKind, version.snapshot)
  }
}

export async function loadCampaignCharacterContentOverlay(
  db: DBLike,
  character: Pick<CharacterAuthored, 'id' | 'systemId' | 'userId'>,
  overrides: readonly CampaignAuthoredSnapshot[] = []
): Promise<CampaignCharacterContentOverlay | null> {
  const repository = createCampaignContentRepository(db)
  const assignment = await repository.findAssignedCampaign(character.id)
  if (!assignment || assignment.userId !== character.userId) return null

  const [versions, bindingRows] = await Promise.all([
    repository.listContentVersions(assignment.campaignId),
    repository.listCharacterBindings(assignment.campaignId, character.id)
  ])
  const latest = new Map<string, CampaignAuthoredSnapshot>()
  for (const version of versions) {
    if (version.state !== 'APPROVED') continue
    const parsed = parseCampaignAuthoredSnapshot(version)
    if (parsed.authored.systemId !== character.systemId) continue
    const key = campaignContentRootKey(parsed.subjectKind, parsed.subjectId)
    if ((latest.get(key)?.revision ?? 0) < parsed.revision) latest.set(key, parsed)
  }
  for (const override of overrides) {
    if (override.authored.systemId === character.systemId) {
      latest.set(campaignContentRootKey(override.subjectKind, override.subjectId), override)
    }
  }

  const overrideByRoot = new Map(
    overrides.map((snapshot) => [
      campaignContentRootKey(snapshot.subjectKind, snapshot.subjectId),
      snapshot
    ])
  )
  const bindings = new Map<string, CampaignAuthoredSnapshot>()
  for (const binding of bindingRows) {
    const key = campaignContentRootKey(binding.subjectKind, binding.subjectId)
    const parsed =
      overrideByRoot.get(key) ??
      parseCampaignAuthoredSnapshot({
        id: binding.contentVersionId,
        revision: binding.revision,
        snapshot: binding.snapshot,
        subjectId: binding.subjectId,
        subjectKind: binding.subjectKind
      })
    if (parsed.authored.systemId !== character.systemId) {
      throw new Error(`Campaign content root "${key}" belongs to a different rules system.`)
    }
    bindings.set(key, parsed)
  }

  return { campaignId: assignment.campaignId, bindings, latest }
}

export function findCampaignCharacterSnapshot(
  overlay: CampaignCharacterContentOverlay | null,
  subjectKind: AuthoredSubjectKind,
  subjectId: string
): CampaignAuthoredSnapshot | null {
  if (!overlay) return null
  const key = campaignContentRootKey(subjectKind, subjectId)
  return overlay.bindings.get(key) ?? overlay.latest.get(key) ?? null
}

async function resolveRaceRecords(
  db: DBLike,
  overlay: CampaignCharacterContentOverlay,
  ids: readonly string[],
  useBindings: boolean
): Promise<ResolvedRace[]> {
  const records = new Map<string, RaceAuthored>()
  const repository = createRaceRepository(db)
  const snapshotFor = (id: string) =>
    useBindings
      ? findCampaignCharacterSnapshot(overlay, 'RACE', id)
      : (overlay.latest.get(campaignContentRootKey('RACE', id)) ?? null)
  const load = async (id: string): Promise<RaceAuthored | null> => {
    const existing = records.get(id)
    if (existing) return existing
    const campaign = snapshotFor(id)
    const record =
      campaign?.subjectKind === 'RACE'
        ? (campaign.authored as unknown as RaceAuthored)
        : await repository.findById(id, { includeFeatureEffects: false })
    if (!record) return null
    records.set(id, record)
    if (record.category === 'SUBRACE') await load(record.parentRaceId)
    return record
  }
  await Promise.all(ids.map(load))
  return ids.flatMap((id) => {
    const record = records.get(id)
    return record ? [resolveRaceAuthored(record, (parentId) => records.get(parentId))] : []
  })
}

async function resolveEquipmentRecords(
  db: DBLike,
  overlay: CampaignCharacterContentOverlay,
  ids: readonly string[],
  useBindings: boolean
): Promise<ResolvedEquipment[]> {
  const records = new Map<string, EquipmentAuthored>()
  const repository = createEquipmentRepository(db)
  const snapshotFor = (id: string) =>
    useBindings
      ? findCampaignCharacterSnapshot(overlay, 'EQUIPMENT', id)
      : (overlay.latest.get(campaignContentRootKey('EQUIPMENT', id)) ?? null)
  const load = async (id: string): Promise<EquipmentAuthored | null> => {
    const existing = records.get(id)
    if (existing) return existing
    const campaign = snapshotFor(id)
    const record =
      campaign?.subjectKind === 'EQUIPMENT'
        ? (campaign.authored as unknown as EquipmentAuthored)
        : await repository.findById(id, { includeEffects: false })
    if (!record) return null
    records.set(id, record)
    if (record.category === 'VARIANT') await load(record.parentEquipmentId)
    return record
  }
  await Promise.all(ids.map(load))
  return ids.flatMap((id) => {
    const record = records.get(id)
    return record ? [resolveEquipmentAuthored(record, (parentId) => records.get(parentId))] : []
  })
}

function latestRecords<T>(
  overlay: CampaignCharacterContentOverlay,
  subjectKind: AuthoredSubjectKind
): T[] {
  return [...overlay.latest.values()].flatMap((snapshot) =>
    snapshot.subjectKind === subjectKind ? [snapshot.authored as T] : []
  )
}

export async function hydrateCampaignCatalogContent(
  db: DBLike,
  overlay: CampaignCharacterContentOverlay
): Promise<HydratedCampaignBuilderContent> {
  const raceIds = latestRecords<RaceAuthored>(overlay, 'RACE').map((record) => record.id)
  const equipmentIds = latestRecords<EquipmentAuthored>(overlay, 'EQUIPMENT').map(
    (record) => record.id
  )
  const [races, equipment] = await Promise.all([
    resolveRaceRecords(db, overlay, raceIds, false),
    resolveEquipmentRecords(db, overlay, equipmentIds, false)
  ])
  return {
    backgrounds: latestRecords(overlay, 'BACKGROUND'),
    classes: latestRecords(overlay, 'CLASS'),
    equipment,
    feats: latestRecords(overlay, 'FEAT'),
    races,
    spells: latestRecords(overlay, 'SPELL')
  }
}

export async function hydrateCampaignSelectedContent(
  db: DBLike,
  overlay: CampaignCharacterContentOverlay,
  input: {
    backgroundIds: readonly string[]
    classIds: readonly string[]
    equipmentIds: readonly string[]
    featIds: readonly string[]
    raceIds: readonly string[]
  }
): Promise<HydratedCampaignBuilderContent> {
  const select = <T>(kind: AuthoredSubjectKind, ids: readonly string[]) =>
    ids.flatMap((id) => {
      const snapshot = findCampaignCharacterSnapshot(overlay, kind, id)
      return snapshot ? [snapshot.authored as T] : []
    })
  const [races, equipment] = await Promise.all([
    resolveRaceRecords(db, overlay, input.raceIds, true),
    resolveEquipmentRecords(db, overlay, input.equipmentIds, true)
  ])
  return {
    backgrounds: select('BACKGROUND', input.backgroundIds),
    classes: select('CLASS', input.classIds),
    equipment,
    feats: select('FEAT', input.featIds),
    races,
    spells: []
  }
}

function rootFeatures(
  ownerKind: 'BACKGROUND' | 'CLASS' | 'EQUIPMENT' | 'FEAT' | 'RACE',
  records: readonly {
    id: string
    features?: readonly { id: string; order: number; availableAtLevel?: number }[]
  }[]
) {
  return records.flatMap((record) =>
    (record.features ?? []).map((feature) => ({
      ownerKind,
      ownerId: record.id,
      featureId: feature.id,
      order: feature.order,
      availableAtLevel: feature.availableAtLevel ?? null
    }))
  )
}

export function buildCampaignAssemblyStructure(
  content: HydratedCampaignBuilderContent
): CharacterAssemblyStructureQueryResult {
  const rootFeatureLinks = [
    ...rootFeatures('RACE', content.races),
    ...rootFeatures('CLASS', content.classes),
    ...rootFeatures('BACKGROUND', content.backgrounds),
    ...rootFeatures('FEAT', content.feats),
    ...rootFeatures('EQUIPMENT', content.equipment)
  ]
  const ancestryOptions = content.races.flatMap((race) =>
    (race.ancestry?.options ?? []).map((option, order) => ({
      raceId: race.id,
      ancestryOptionId: option.id,
      order,
      featureLinks: (option.features ?? []).map((feature) => ({
        featureId: feature.id,
        order: feature.order,
        availableAtLevel: feature.availableAtLevel ?? null
      }))
    }))
  )
  const features = [
    ...content.races.flatMap((record) => record.features ?? []),
    ...content.races.flatMap(
      (record) => record.ancestry?.options.flatMap((option) => option.features ?? []) ?? []
    ),
    ...content.classes.flatMap((record) => record.features ?? []),
    ...content.backgrounds.flatMap((record) => record.features ?? []),
    ...content.feats.flatMap((record) => record.features ?? []),
    ...content.equipment.flatMap((record) => record.features ?? [])
  ]
  return {
    rootFeatureLinks,
    ancestryOptions,
    featureOptions: features.flatMap((feature) =>
      (feature.options ?? []).map((option) => ({
        featureId: feature.id,
        optionId: option.id,
        order: option.order
      }))
    ),
    featureOptionChoices: features.flatMap((feature) =>
      (feature.optionChoices ?? []).map((choice, order) => ({
        featureId: feature.id,
        level: choice.level,
        count: choice.count,
        order
      }))
    )
  }
}

function collectSelectedIds(character: CharacterAuthored): Set<string> {
  return new Set(
    [
      character.intent.race.raceId,
      character.intent.race.subraceId,
      character.intent.background.backgroundId,
      ...character.intent.classes.flatMap((record) => [record.classId, record.subclassId]),
      ...character.intent.featureAcquisitions.flatMap((record) =>
        record.source.kind === 'FEAT' ? [record.source.featId] : []
      ),
      ...(character.intent.chosenGrantSelections ?? []).flatMap((record) => record.targetIds),
      ...(character.intent.spellSelections ?? []).flatMap((record) => record.spells),
      ...(character.state.classes ?? []).flatMap((record) => [
        ...(record.spells?.learned ?? []),
        ...(record.spells?.prepared ?? [])
      ]),
      ...character.state.equipment.inventory.map((record) => record.equipmentId),
      ...Object.values(character.intent.startingEquipment ?? {}).flatMap(
        (decision) =>
          decision?.groups?.flatMap(
            (group) => group.selections?.map((selection) => selection.equipmentId) ?? []
          ) ?? []
      )
    ].filter((id): id is string => Boolean(id))
  )
}

export async function replaceCampaignCharacterContentBindings(
  db: DBLike,
  character: CharacterAuthored
): Promise<void> {
  const overlay = await loadCampaignCharacterContentOverlay(db, character)
  if (!overlay) return
  const selectedIds = collectSelectedIds(character)
  const bindings: CampaignCharacterContentBindingInput[] = []
  for (const [key, latest] of overlay.latest) {
    if (!selectedIds.has(latest.subjectId)) continue
    const selected = overlay.bindings.get(key) ?? latest
    bindings.push({
      subjectKind: selected.subjectKind,
      subjectId: selected.subjectId,
      contentVersionId: selected.contentVersionId
    })
  }
  await createCampaignContentRepository(db).replaceCharacterBindings({
    campaignId: overlay.campaignId,
    characterId: character.id,
    bindings
  })
}

export async function lockCampaignCharacterContentForSave(
  db: DBLike,
  characterId: string
): Promise<void> {
  const content = createCampaignContentRepository(db)
  const assignment = await content.findAssignedCampaign(characterId)
  if (!assignment) return
  if (!(await createCampaignRepository(db).lockCampaign(assignment.campaignId))) return
  await content.lockCharacterBindings(assignment.campaignId, characterId)
}
