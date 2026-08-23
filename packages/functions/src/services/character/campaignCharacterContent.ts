import {
  createCampaignContentShareRepository,
  createCampaignRepository,
  createAuthoredVersionRepository,
  type AuthoredSubjectKind,
  type AuthoredVersionRecord,
  type CampaignContentShare,
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

export interface CampaignAuthoredSource {
  subjectKind: AuthoredSubjectKind
  subjectId: string
  authoredVersionId: string
  authoredVersion: number
  authoredChecksum: string
  compiledProjectionChecksum: string
  authoredDependencies: readonly AuthoredVersionRecord['compiled']['authoredDependencies'][number][]
  authored: AuthoredVersionRecord['authored']['document']
}

export interface CampaignCharacterContentOverlay {
  campaignId: string
  userId: string
  latest: ReadonlyMap<string, CampaignAuthoredSource>
  /** Real Campaign shares only. Synthetic Builder overrides never authorize committed use. */
  sharesByRoot: ReadonlyMap<string, CampaignContentShare>
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

function toCampaignAuthoredSource(authored: AuthoredVersionRecord): CampaignAuthoredSource {
  return {
    subjectKind: authored.authored.subjectKind,
    subjectId: authored.authored.subjectId,
    authoredVersionId: authored.authored.versionId,
    authoredVersion: authored.authored.version,
    authoredChecksum: authored.authored.checksum,
    compiledProjectionChecksum: authored.compiled.projectionChecksum,
    authoredDependencies: authored.compiled.authoredDependencies,
    authored: authored.authored.document
  }
}

export async function loadCampaignCharacterContentOverlay(
  db: DBLike,
  character: Pick<CharacterAuthored, 'id' | 'systemId' | 'userId'>,
  overrides: readonly CampaignAuthoredSource[] = []
): Promise<CampaignCharacterContentOverlay | null> {
  const assignment = await createCampaignRepository(db).findCampaignByCharacter(character.id)
  if (!assignment || assignment.userId !== character.userId) return null

  const latest = new Map<string, CampaignAuthoredSource>()
  const sharesByRoot = new Map<string, CampaignContentShare>()
  const current = await createCampaignContentShareRepository(db).listCurrentSources(
    assignment.campaignId
  )
  for (const { share, source } of current) {
    const parsed = toCampaignAuthoredSource(source)
    if (parsed.authored.systemId !== character.systemId) continue
    const key = campaignContentRootKey(parsed.subjectKind, parsed.subjectId)
    latest.set(key, parsed)
    sharesByRoot.set(key, share)
  }
  for (const override of overrides) {
    if (override.authored.systemId === character.systemId) {
      const key = campaignContentRootKey(override.subjectKind, override.subjectId)
      latest.set(key, override)
      sharesByRoot.delete(key)
    }
  }
  return { campaignId: assignment.campaignId, userId: character.userId, latest, sharesByRoot }
}

export function findCampaignCharacterSource(
  overlay: CampaignCharacterContentOverlay | null,
  subjectKind: AuthoredSubjectKind,
  subjectId: string
): CampaignAuthoredSource | null {
  if (!overlay) return null
  const key = campaignContentRootKey(subjectKind, subjectId)
  return overlay.latest.get(key) ?? null
}

async function loadCampaignTopLevelSource<T extends { systemId: string }>(input: {
  db: DBLike
  overlay: CampaignCharacterContentOverlay
  subjectId: string
  subjectKind: AuthoredSubjectKind
  systemId?: string
}): Promise<CampaignVersionedSource<T> | null> {
  const snapshot = findCampaignCharacterSource(input.overlay, input.subjectKind, input.subjectId)
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
  systemId?: string
): Promise<ResolvedRace[]> {
  const records = await Promise.all(
    ids.map(async (id) => {
      const root = await loadCampaignTopLevelSource<RaceAuthored>({
        db,
        overlay,
        subjectKind: 'RACE',
        subjectId: id,
        systemId
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
  systemId?: string
): Promise<ResolvedEquipment[]> {
  const records = await Promise.all(
    ids.map(async (id) => {
      const root = await loadCampaignTopLevelSource<EquipmentAuthored>({
        db,
        overlay,
        subjectKind: 'EQUIPMENT',
        subjectId: id,
        systemId
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
    resolveRaceRecords(db, overlay, raceIds),
    resolveEquipmentRecords(db, overlay, equipmentIds)
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
      const source = findCampaignCharacterSource(overlay, kind, id)
      return source ? [source.authored as T] : []
    })
  const [races, equipment] = await Promise.all([
    resolveRaceRecords(db, overlay, input.raceIds, input.systemId),
    resolveEquipmentRecords(db, overlay, input.equipmentIds, input.systemId)
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

export async function lockCampaignCharacterContentForSave(
  db: DBLike,
  characterId: string
): Promise<string | null> {
  const campaign = createCampaignRepository(db)
  const assignment = await campaign.findCampaignByCharacter(characterId)
  if (!assignment) return null
  if (!(await campaign.lockCampaign(assignment.campaignId))) return null
  return assignment.campaignId
}
