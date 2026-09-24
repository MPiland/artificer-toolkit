import { z } from '../zod.js'
import { campaignNotebookSectionDtoSchema } from '../api/campaignSessions.js'
import { uuidSchema } from '../api/campaignContractSchemas.js'

export const campaignStoredNotebookSectionSchema = z.extend(campaignNotebookSectionDtoSchema, {
  sortOrder: z.number().check(z.int()).check(z.nonnegative()),
  createdBy: uuidSchema,
  updatedBy: uuidSchema
})
