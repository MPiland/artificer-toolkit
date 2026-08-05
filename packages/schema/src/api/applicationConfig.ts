import { z } from 'zod'

export const applicationFeatureFlagsDtoSchema = z.object({
  libraryImportEnabled: z.boolean(),
  publicSignUpEnabled: z.boolean()
})

export type ApplicationFeatureFlagsDto = z.infer<typeof applicationFeatureFlagsDtoSchema>
