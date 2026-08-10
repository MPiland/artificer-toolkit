import type { DbTables, DBLike } from '#types'
import { toIsoString, type RuntimeTimestamp } from './campaignCollaborationShared.js'

export type CampaignNoteVisibility = 'GM_PRIVATE' | 'SHARED'
export type CampaignNoteCategory = 'GENERAL' | 'PEOPLE' | 'PLACES'
type NoteSectionRow = Omit<
  DbTables['campaign_note_sections']['Row'],
  'created_at' | 'updated_at'
> & { created_at: RuntimeTimestamp; updated_at: RuntimeTimestamp }
export interface CampaignNoteSection {
  id: string
  campaignId: string
  title: string
  content: string
  visibility: CampaignNoteVisibility
  category: CampaignNoteCategory
  sortOrder: number
  version: number
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}
export interface InsertCampaignNoteSectionInput {
  campaignId: string
  title: string
  content: string
  visibility: CampaignNoteVisibility
  category: CampaignNoteCategory
  sortOrder: number
  createdBy: string
}
export interface UpdateCampaignNoteSectionInput {
  campaignId: string
  id: string
  expectedVersion: number
  title: string
  content: string
  visibility: CampaignNoteVisibility
  category: CampaignNoteCategory
  sortOrder: number
  updatedBy: string
  updatedAt: string
}
function toNoteSection(row: NoteSectionRow): CampaignNoteSection {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    content: row.content,
    visibility: row.visibility as CampaignNoteVisibility,
    category: row.category as CampaignNoteCategory,
    sortOrder: row.sort_order,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}
export function createCampaignNotebookRepository(db: DBLike) {
  return {
    async listCampaignNoteSections(
      campaignId: string,
      visibility: 'ALL' | 'SHARED'
    ): Promise<CampaignNoteSection[]> {
      let query = db
        .selectFrom('campaign_note_sections')
        .selectAll()
        .where('campaign_id', '=', campaignId)
      if (visibility === 'SHARED') query = query.where('visibility', '=', 'SHARED')
      return (
        (await query
          .orderBy('sort_order', 'asc')
          .orderBy('id', 'asc')
          .execute()) as NoteSectionRow[]
      ).map(toNoteSection)
    },
    async insertCampaignNoteSection(
      input: InsertCampaignNoteSectionInput
    ): Promise<CampaignNoteSection> {
      return toNoteSection(
        (await db
          .insertInto('campaign_note_sections')
          .values({
            campaign_id: input.campaignId,
            title: input.title,
            content: input.content,
            visibility: input.visibility,
            category: input.category,
            sort_order: input.sortOrder,
            created_by: input.createdBy,
            updated_by: input.createdBy
          })
          .returningAll()
          .executeTakeFirstOrThrow()) as NoteSectionRow
      )
    },
    async updateCampaignNoteSection(
      input: UpdateCampaignNoteSectionInput
    ): Promise<CampaignNoteSection | null> {
      const row = (await db
        .updateTable('campaign_note_sections')
        .set({
          title: input.title,
          content: input.content,
          visibility: input.visibility,
          category: input.category,
          sort_order: input.sortOrder,
          updated_by: input.updatedBy,
          updated_at: input.updatedAt,
          version: input.expectedVersion + 1
        })
        .where('campaign_id', '=', input.campaignId)
        .where('id', '=', input.id)
        .where('version', '=', input.expectedVersion)
        .returningAll()
        .executeTakeFirst()) as NoteSectionRow | undefined
      return row ? toNoteSection(row) : null
    },
    async deleteCampaignNoteSection(campaignId: string, id: string): Promise<boolean> {
      return Boolean(
        await db
          .deleteFrom('campaign_note_sections')
          .where('campaign_id', '=', campaignId)
          .where('id', '=', id)
          .returning('id')
          .executeTakeFirst()
      )
    }
  }
}
