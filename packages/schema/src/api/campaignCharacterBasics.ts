import { z, lazySchema } from '../zod.js'
import { uuidSchema } from './campaignContractSchemas.js'

// The party roster subscribes one basics query per assigned Character, so this contract stays out of
// the Sheet schema graph (PERF-6.2).
export const campaignCharacterBasicsInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    characterId: uuidSchema
  })
)

/**
 * The public roster basics every Campaign member sees for an assigned Character (ADR 0034 decision 5).
 * sheetVisible tells another player whether the Character's "Party can view" is on.
 */
export const campaignCharacterBasicsDtoSchema = lazySchema(() =>
  z.strictObject({
    characterId: z.string().check(z.uuid()),
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100)),
    classSummary: z.string(),
    totalLevel: z.number().check(z.int()).check(z.nonnegative()),
    sheetVisible: z.boolean()
  })
)
export type CampaignCharacterBasicsDto = z.infer<typeof campaignCharacterBasicsDtoSchema>
