import { z } from '../zod.js'

export const applicationFeatureFlagsDtoSchema = z.object({
  libraryImportEnabled: z.boolean(),
  publicSignUpEnabled: z.boolean()
})

export type ApplicationFeatureFlagsDto = z.infer<typeof applicationFeatureFlagsDtoSchema>
