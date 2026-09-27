import { z, lazySchema } from '../zod.js'
import { campaignNotebookSectionDtoSchema } from '../api/campaignSessions.js'
import { uuidSchema } from '../api/campaignContractSchemas.js'

export const campaignStoredNotebookSectionSchema = lazySchema(() =>
  z.extend(campaignNotebookSectionDtoSchema, {
    sortOrder: z.number().check(z.int()).check(z.nonnegative()),
    createdBy: uuidSchema,
    updatedBy: uuidSchema
  })
)
