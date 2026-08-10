import {
  createCampaignCollaborationRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import {
  campaignNotebookSectionDtoSchema,
  campaignNotebookSectionsDtoSchema,
  type CampaignNotebookSectionDto
} from '@artificer-toolkit/schema/api/campaigns'
import type { z } from 'zod'
import {
  createCampaignNotebookSectionInputSchema,
  deleteCampaignNotebookSectionInputSchema,
  listCampaignNotebookSectionsInputSchema,
  updateCampaignNotebookSectionInputSchema
} from '@artificer-toolkit/schema/api/campaigns'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  CampaignAccessError,
  CampaignConflictError,
  resolveCampaignAuthority
} from './campaignService.js'
import { broadcast, lockCampaign, now } from './campaignCollaborationShared.js'

type CreateNotebookInput = z.input<typeof createCampaignNotebookSectionInputSchema>
type UpdateNotebookInput = z.input<typeof updateCampaignNotebookSectionInputSchema>
type DeleteNotebookInput = z.input<typeof deleteCampaignNotebookSectionInputSchema>

function mapNotebookSection(section: {
  id: string
  campaignId: string
  title: string
  content: string
  visibility: 'GM_PRIVATE' | 'SHARED'
  category: 'GENERAL' | 'PEOPLE' | 'PLACES'
  version: number
  createdAt: string
  updatedAt: string
}): CampaignNotebookSectionDto {
  return campaignNotebookSectionDtoSchema.parse({
    id: section.id,
    campaignId: section.campaignId,
    title: section.title,
    content: section.content,
    visibility: section.visibility,
    category: section.category,
    version: section.version,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt
  })
}

function notebookScope(visibility: 'GM_PRIVATE' | 'SHARED'): 'OWNER' | 'TABLE' {
  return visibility === 'SHARED' ? 'TABLE' : 'OWNER'
}

export async function listCampaignNotebookSections(
  db: DBLike,
  input: z.input<typeof listCampaignNotebookSectionsInputSchema>,
  userId: string
): Promise<CampaignNotebookSectionDto[]> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertActiveCampaignMember(authority)
  const visibility = authority.membership.role === 'OWNER' ? 'ALL' : 'SHARED'
  return campaignNotebookSectionsDtoSchema.parse(
    (
      await createCampaignCollaborationRepository(db).listCampaignNoteSections(
        input.campaignId,
        visibility
      )
    ).map(mapNotebookSection)
  )
}

export async function createCampaignNotebookSection(
  db: DBLike,
  input: CreateNotebookInput,
  userId: string
): Promise<CampaignNotebookSectionDto> {
  const section = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    assertCampaignOwner(authority)
    const visibility = input.visibility ?? 'GM_PRIVATE'
    return createCampaignCollaborationRepository(trx).insertCampaignNoteSection({
      campaignId: input.campaignId,
      title: input.title,
      content: input.content,
      visibility,
      category: input.category ?? 'GENERAL',
      sortOrder: 0,
      createdBy: userId
    })
  })
  await broadcast(
    db,
    input.campaignId,
    notebookScope(section.visibility),
    'NOTE',
    section.id,
    'CREATED',
    section.createdAt
  )
  return mapNotebookSection(section)
}

export async function updateCampaignNotebookSection(
  db: DBLike,
  input: UpdateNotebookInput,
  userId: string
): Promise<CampaignNotebookSectionDto> {
  const { section, oldVisibility } = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    assertCampaignOwner(authority)
    const repository = createCampaignCollaborationRepository(trx)
    const existing = (await repository.listCampaignNoteSections(input.campaignId, 'ALL')).find(
      (section) => section.id === input.sectionId
    )
    if (!existing) throw new CampaignAccessError()
    const visibility = input.visibility ?? existing.visibility
    const section = await repository.updateCampaignNoteSection({
      campaignId: input.campaignId,
      id: input.sectionId,
      expectedVersion: input.expectedVersion,
      title: input.title === undefined ? existing.title : input.title,
      content: input.content ?? existing.content,
      visibility,
      category: input.category ?? existing.category,
      sortOrder: existing.sortOrder,
      updatedBy: userId,
      updatedAt: now()
    })
    if (!section) throw new CampaignConflictError()
    return { section, oldVisibility: existing.visibility }
  })
  const oldScope = notebookScope(oldVisibility)
  const newScope = notebookScope(section.visibility)
  await broadcast(db, input.campaignId, oldScope, 'NOTE', section.id, 'UPDATED', section.updatedAt)
  if (newScope !== oldScope)
    await broadcast(
      db,
      input.campaignId,
      newScope,
      'NOTE',
      section.id,
      'UPDATED',
      section.updatedAt
    )
  return mapNotebookSection(section)
}

export async function deleteCampaignNotebookSection(
  db: DBLike,
  input: DeleteNotebookInput,
  userId: string
): Promise<{ ok: true }> {
  const visibility = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    assertCampaignOwner(authority)
    const repository = createCampaignCollaborationRepository(trx)
    const existing = (await repository.listCampaignNoteSections(input.campaignId, 'ALL')).find(
      (section) => section.id === input.sectionId
    )
    if (!existing) throw new CampaignAccessError()
    if (!(await repository.deleteCampaignNoteSection(input.campaignId, input.sectionId)))
      throw new CampaignAccessError()
    return existing.visibility
  })
  await broadcast(
    db,
    input.campaignId,
    notebookScope(visibility),
    'NOTE',
    input.sectionId,
    'DELETED',
    now()
  )
  return { ok: true }
}
