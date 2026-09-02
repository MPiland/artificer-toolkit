import {
  createReusableDefinitionRepository,
  createSystemVocabularySnapshotRepository,
  type DBLike,
  type ReusableDefinitionRootRecord
} from '@artificer-toolkit/db'
import {
  createReusableDefinitionInputDtoSchema,
  publishReusableDefinitionDraftInputDtoSchema,
  reusableDefinitionSummaryDtoSchema,
  reusableDefinitionWorkspaceDtoSchema,
  saveReusableDefinitionDraftInputDtoSchema,
  type CreateReusableDefinitionInputDto,
  type PublishReusableDefinitionDraftInputDto,
  type ReusableDefinitionSummaryDto,
  type ReusableDefinitionWorkspaceDto,
  type SaveReusableDefinitionDraftInputDto
} from '@artificer-toolkit/schema/api/reusableDefinitions'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'

import {
  createPlatformReusableDefinitionService,
  requireInstalledGameSystemRuleCapability
} from './platformRulesRuntime.js'

export class ReusableDefinitionAuthoringAccessError extends Error {
  constructor(message = 'Reusable definition is unavailable.') {
    super(message)
    this.name = 'ReusableDefinitionAuthoringAccessError'
  }
}

function canView(root: ReusableDefinitionRootRecord, actorUserId: string) {
  return root.sourceKind === 'PLATFORM' || root.sourceOwnerUserId === actorUserId
}

function isEditable(root: ReusableDefinitionRootRecord, actorUserId: string) {
  return root.sourceKind === 'USER' && root.sourceOwnerUserId === actorUserId
}

function presentSummary(
  root: ReusableDefinitionRootRecord,
  actorUserId: string
): ReusableDefinitionSummaryDto {
  return reusableDefinitionSummaryDtoSchema.parse({
    id: root.id,
    gameSystemId: root.gameSystemId,
    contentSourceId: root.contentSourceId,
    definitionFamilyKey: root.definitionFamilyKey,
    label: root.label,
    description: root.description,
    version: root.version,
    sourceKind: root.sourceKind,
    editable: isEditable(root, actorUserId),
    currentVersion: root.current?.version ?? null,
    draftVersion: root.draftVersion
  })
}

async function requireVisibleWorkspace(
  db: DBLike,
  actorUserId: string,
  definitionId: string
): Promise<ReusableDefinitionWorkspaceDto> {
  const repository = createReusableDefinitionRepository(db)
  const root = await repository.getRoot(definitionId)
  if (!root || !canView(root, actorUserId)) throw new ReusableDefinitionAuthoringAccessError()
  const draft = isEditable(root, actorUserId) ? await repository.getDraft(root) : null
  return reusableDefinitionWorkspaceDtoSchema.parse({
    ...presentSummary(root, actorUserId),
    current: root.current,
    draft
  })
}

export async function listReusableDefinitions(
  db: DBLike,
  actorUserId: string,
  gameSystemId: string
): Promise<ReusableDefinitionSummaryDto[]> {
  const parsedUserId = serverUuidIdentityDtoSchema.parse(actorUserId)
  const parsedSystemId = serverUuidIdentityDtoSchema.parse(gameSystemId)
  requireInstalledGameSystemRuleCapability(parsedSystemId)
  const roots = await createReusableDefinitionRepository(db).listRootsForUser({
    gameSystemId: parsedSystemId,
    actorUserId: parsedUserId
  })
  return roots.map((root) => presentSummary(root, parsedUserId))
}

export async function getReusableDefinition(db: DBLike, actorUserId: string, definitionId: string) {
  return requireVisibleWorkspace(
    db,
    serverUuidIdentityDtoSchema.parse(actorUserId),
    serverUuidIdentityDtoSchema.parse(definitionId)
  )
}

export async function createReusableDefinition(
  db: DBLike,
  actorUserId: string,
  rawInput: CreateReusableDefinitionInputDto
) {
  const input = createReusableDefinitionInputDtoSchema.parse(rawInput)
  const parsedUserId = serverUuidIdentityDtoSchema.parse(actorUserId)
  const capability = requireInstalledGameSystemRuleCapability(input.gameSystemId)
  if (!capability.definitionFamilyKeys.includes(input.definitionFamilyKey)) {
    throw new ReusableDefinitionAuthoringAccessError(
      'Reusable definition family is unavailable for this Game System.'
    )
  }
  const root = await createReusableDefinitionRepository(db).createRoot({
    ...input,
    actorUserId: parsedUserId
  })
  return reusableDefinitionWorkspaceDtoSchema.parse({
    ...presentSummary(root, parsedUserId),
    current: null,
    draft: null
  })
}

export async function saveReusableDefinitionDraft(
  db: DBLike,
  actorUserId: string,
  rawInput: SaveReusableDefinitionDraftInputDto
) {
  const input = saveReusableDefinitionDraftInputDtoSchema.parse(rawInput)
  const parsedUserId = serverUuidIdentityDtoSchema.parse(actorUserId)
  const repository = createReusableDefinitionRepository(db)
  await createPlatformReusableDefinitionService(repository, async (gameSystemId) => {
    const snapshot =
      await createSystemVocabularySnapshotRepository(db).findActiveForPublication(gameSystemId)
    if (!snapshot) throw new ReusableDefinitionAuthoringAccessError('Game System is unavailable.')
    return snapshot.document
  }).saveDraft({
    ...input,
    actorUserId: parsedUserId
  })
  return requireVisibleWorkspace(db, parsedUserId, input.definitionId)
}

export async function publishReusableDefinitionDraft(
  db: DBLike,
  actorUserId: string,
  rawInput: PublishReusableDefinitionDraftInputDto
) {
  const input = publishReusableDefinitionDraftInputDtoSchema.parse(rawInput)
  const parsedUserId = serverUuidIdentityDtoSchema.parse(actorUserId)
  const repository = createReusableDefinitionRepository(db)
  await createPlatformReusableDefinitionService(repository, async (gameSystemId) => {
    const snapshot =
      await createSystemVocabularySnapshotRepository(db).findActiveForPublication(gameSystemId)
    if (!snapshot) throw new ReusableDefinitionAuthoringAccessError('Game System is unavailable.')
    return snapshot.document
  }).publishDraft({
    ...input,
    actorUserId: parsedUserId
  })
  return requireVisibleWorkspace(db, parsedUserId, input.definitionId)
}
