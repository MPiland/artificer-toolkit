import { z, lazySchema } from '../zod.js'
import { campaignNotebookSectionDtoSchema } from '../api/campaignSessions.js'
import { uuidSchema } from '../api/campaignContractSchemas.js'

export const campaignStoredNotebookSectionSchema = lazySchema(() =>
  z.extend(z.omit(campaignNotebookSectionDtoSchema, { authorLabel: true }), {
    sortOrder: z.number().check(z.int()).check(z.nonnegative()),
    updatedBy: uuidSchema
  })
)
