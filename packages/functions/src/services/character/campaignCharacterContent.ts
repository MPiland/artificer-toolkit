import {
  createCampaignContentRepository,
  createCampaignRepository,
  createAuthoredVersionRepository,
  type AuthoredSubjectKind,
  type AuthoredVersionRecord,
  type CampaignCharacterContentBindingInput,
  type CharacterAssemblyStructureQueryResult,
  type DBLike
} from '@artificer-toolkit/db'
import type { AuthoredVersionVector } from '@artificer-toolkit/schema/projections/identity'
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

export interface CampaignAuthoredSnapshot {
  contentVersionId: string
  subjectKind: AuthoredSubjectKind
  subjectId: string
  revision: number
  authoredVersionId: string
  authoredVersion: number
  authoredChecksum: string
  compiledProjectionChecksum: string
  authoredDependencies: readonly AuthoredVersionRecord['compiled']['authoredDependencies'][number][]
  authored: AuthoredVersionRecord['authored']['document']
}

interface CampaignContentVersionReference {
  id: string
  subjectKind: AuthoredSubjectKind
  subjectId: string
  revision: number
  authoredVersionId: string
  authoredVersion: number
  authoredChecksum: string
  compiledProjectionChecksum: string
}

export interface CampaignCharacterContentOverlay {
  campaignId: string
  userId: string
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

interface CampaignVersionedSource<T extends { systemId: string }> {
  authored: T
  authoredDependencies: readonly AuthoredVersionVector[number][]
}

export function campaignContentRootKey(
  subjectKind: AuthoredSubjectKind,
  subjectId: string
): string {
  return `${subjectKind}:${subjectId}`
}

function toCampaignAuthoredSnapshot(
  version: CampaignContentVersionReference,
  authored: AuthoredVersionRecord
): CampaignAuthoredSnapshot {
  if (
    authored.authored.subjectKind !== version.subjectKind ||
    authored.authored.subjectId !== version.subjectId ||
    authored.authored.versionId !== version.authoredVersionId ||
    authored.authored.version !== version.authoredVersion ||
    authored.authored.checksum !== version.authoredChecksum ||
    authored.compiled.projectionChecksum !== version.compiledProjectionChecksum
  ) {
    throw new Error(`Campaign content version "${version.id}" has a mismatched authored version.`)
  }
  return {
    contentVersionId: version.id,
    subjectKind: version.subjectKind,
    subjectId: version.subjectId,
    revision: version.revision,
    authoredVersionId: version.authoredVersionId,
    authoredVersion: version.authoredVersion,
    authoredChecksum: version.authoredChecksum,
    compiledProjectionChecksum: version.compiledProjectionChecksum,
    authoredDependencies: authored.compiled.authoredDependencies,
    authored: authored.authored.document
  }
}

async function loadCampaignAuthoredSnapshots(
  db: DBLike,
  versions: readonly CampaignContentVersionReference[]
): Promise<Map<string, CampaignAuthoredSnapshot>> {
  const versionsByKind = new Map<AuthoredSubjectKind, CampaignContentVersionReference[]>()
  for (const version of versions) {
    const entries = versionsByKind.get(version.subjectKind) ?? []
    entries.push(version)
    versionsByKind.set(version.subjectKind, entries)
  }

  const authoredRepository = createAuthoredVersionRepository(db)
  const snapshots = new Map<string, CampaignAuthoredSnapshot>()
  await Promise.all(
    [...versionsByKind.entries()].map(async ([subjectKind, entries]) => {
      const records = await authoredRepository.findVersionsByIds({
        subjectKind,
        versionIds: entries.map((entry) => entry.authoredVersionId)
      })
      for (const entry of entries) {
        const record = records.get(entry.authoredVersionId)
        if (!record) {
          throw new Error(
            `Campaign content version "${entry.id}" references an unavailable authored version.`
          )
        }
        snapshots.set(entry.id, toCampaignAuthoredSnapshot(entry, record))
      }
    })
  )
  return snapshots
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
  const snapshots = await loadCampaignAuthoredSnapshots(db, [
    ...versions,
    ...bindingRows.map((binding) => ({
      id: binding.contentVersionId,
      subjectKind: binding.subjectKind,
      subjectId: binding.subjectId,
      revision: binding.revision,
      authoredVersionId: binding.authoredVersionId,
      authoredVersion: binding.authoredVersion,
      authoredChecksum: binding.authoredChecksum,
      compiledProjectionChecksum: binding.compiledProjectionChecksum
    }))
  ])
  const latest = new Map<string, CampaignAuthoredSnapshot>()
  for (const version of versions) {
    if (version.state !== 'APPROVED') continue
    const parsed = snapshots.get(version.id)
    if (!parsed) throw new Error(`Campaign content version "${version.id}" is unavailable.`)
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
      snapshots.get(binding.contentVersionId)
    if (!parsed) {
      throw new Error(`Campaign content binding "${binding.contentVersionId}" is unavailable.`)
    }
    if (parsed.authored.systemId !== character.systemId) {
      throw new Error(`Campaign content root "${key}" belongs to a different rules system.`)
    }
    bindings.set(key, parsed)
  }

  return { campaignId: assignment.campaignId, userId: character.userId, bindings, latest }
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

async function loadCampaignTopLevelSource<T extends { systemId: string }>(input: {
  db: DBLike
  overlay: CampaignCharacterContentOverlay
  subjectId: string
  subjectKind: AuthoredSubjectKind
  systemId?: string
  useBindings: boolean
}): Promise<CampaignVersionedSource<T> | null> {
  const snapshot = input.useBindings
    ? findCampaignCharacterSnapshot(input.overlay, input.subjectKind, input.subjectId)
    : (input.overlay.latest.get(campaignContentRootKey(input.subjectKind, input.subjectId)) ?? null)
  if (snapshot?.subjectKind === input.subjectKind) {
    const authored = snapshot.authored as unknown as T
    return !input.systemId || authored.systemId === input.systemId
      ? { authored, authoredDependencies: snapshot.authoredDependencies }
      : null
  }

  const records = await createAuthoredVersionRepository(input.db).findActiveByIds({
    subjectKind: input.subjectKind,
    subjectIds: [input.subjectId],
    systemId: input.systemId,
    userId: input.overlay.userId,
    includeMaster: true
  })
  const record = records.get(input.subjectId)
  if (!record) return null
  const authored = record.authored.document as unknown as T
  return !input.systemId || authored.systemId === input.systemId
    ? { authored, authoredDependencies: record.compiled.authoredDependencies }
    : null
}

async function loadCampaignExactDependencySource<T extends { systemId: string }>(input: {
  db: DBLike
  owner: CampaignVersionedSource<{ systemId: string }>
  subjectId: string
  subjectKind: AuthoredSubjectKind
  systemId: string
}): Promise<CampaignVersionedSource<T>> {
  const dependency = input.owner.authoredDependencies.find(
    (entry) => entry.subjectKind === input.subjectKind && entry.subjectId === input.subjectId
  )
  if (!dependency) {
    throw new Error(
      `Campaign content is missing exact ${input.subjectKind} dependency "${input.subjectId}".`
    )
  }
  const records = await createAuthoredVersionRepository(input.db).findExactVersions({
    entries: [dependency]
  })
  const record = records.get(campaignContentRootKey(input.subjectKind, input.subjectId))
  if (!record) {
    throw new Error(
      `Campaign content has an unavailable exact ${input.subjectKind} dependency "${input.subjectId}".`
    )
  }
  const authored = record.authored.document as unknown as T
  if (authored.systemId !== input.systemId) {
    throw new Error(
      `Campaign content dependency ${input.subjectKind} "${input.subjectId}" belongs to another rules system.`
    )
  }
  return { authored, authoredDependencies: record.compiled.authoredDependencies }
}

async function resolveRaceRecords(
  db: DBLike,
  overlay: CampaignCharacterContentOverlay,
  ids: readonly string[],
  useBindings: boolean,
  systemId?: string
): Promise<ResolvedRace[]> {
  const records = await Promise.all(
    ids.map(async (id) => {
      const root = await loadCampaignTopLevelSource<RaceAuthored>({
        db,
        overlay,
        subjectKind: 'RACE',
        subjectId: id,
        systemId,
        useBindings
      })
      if (!root) return null
      const parents = new Map<string, RaceAuthored>()
      const loadParents = async (
        source: CampaignVersionedSource<RaceAuthored>,
        lineage: ReadonlySet<string> = new Set()
      ): Promise<void> => {
        if (source.authored.category !== 'SUBRACE') return
        if (lineage.has(source.authored.id)) {
          throw new Error(`Campaign Subrace "${source.authored.id}" has a parent cycle.`)
        }
        const parent = await loadCampaignExactDependencySource<RaceAuthored>({
          db,
          owner: source,
          subjectKind: 'RACE',
          subjectId: source.authored.parentRaceId,
          systemId: source.authored.systemId
        })
        parents.set(parent.authored.id, parent.authored)
        await loadParents(parent, new Set([...lineage, source.authored.id]))
      }
      await loadParents(root)
      return resolveRaceAuthored(root.authored, (parentId) => parents.get(parentId))
    })
  )
  return records.filter((record): record is ResolvedRace => record !== null)
}

async function resolveEquipmentRecords(
  db: DBLike,
  overlay: CampaignCharacterContentOverlay,
  ids: readonly string[],
  useBindings: boolean,
  systemId?: string
): Promise<ResolvedEquipment[]> {
  const records = await Promise.all(
    ids.map(async (id) => {
      const root = await loadCampaignTopLevelSource<EquipmentAuthored>({
        db,
        overlay,
        subjectKind: 'EQUIPMENT',
        subjectId: id,
        systemId,
        useBindings
      })
      if (!root) return null
      const parents = new Map<string, EquipmentAuthored>()
      const loadParents = async (
        source: CampaignVersionedSource<EquipmentAuthored>,
        lineage: ReadonlySet<string> = new Set()
      ): Promise<void> => {
        if (source.authored.category !== 'VARIANT') return
        if (lineage.has(source.authored.id)) {
          throw new Error(`Campaign Equipment variant "${source.authored.id}" has a parent cycle.`)
        }
        const parent = await loadCampaignExactDependencySource<EquipmentAuthored>({
          db,
          owner: source,
          subjectKind: 'EQUIPMENT',
          subjectId: source.authored.parentEquipmentId,
          systemId: source.authored.systemId
        })
        parents.set(parent.authored.id, parent.authored)
        await loadParents(parent, new Set([...lineage, source.authored.id]))
      }
      await loadParents(root)
      return resolveEquipmentAuthored(root.authored, (parentId) => parents.get(parentId))
    })
  )
  return records.filter((record): record is ResolvedEquipment => record !== null)
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
    systemId: string
  }
): Promise<HydratedCampaignBuilderContent> {
  const select = <T>(kind: AuthoredSubjectKind, ids: readonly string[]) =>
    ids.flatMap((id) => {
      const snapshot = findCampaignCharacterSnapshot(overlay, kind, id)
      return snapshot ? [snapshot.authored as T] : []
    })
  const [races, equipment] = await Promise.all([
    resolveRaceRecords(db, overlay, input.raceIds, true, input.systemId),
    resolveEquipmentRecords(db, overlay, input.equipmentIds, true, input.systemId)
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
): Promise<string | null> {
  const content = createCampaignContentRepository(db)
  const assignment = await content.findAssignedCampaign(characterId)
  if (!assignment) return null
  if (!(await createCampaignRepository(db).lockCampaign(assignment.campaignId))) return null
  await content.lockCharacterBindings(assignment.campaignId, characterId)
  return assignment.campaignId
}
