import { z, lazySchema } from '../zod.js'

export const applicationFeatureFlagsDtoSchema = lazySchema(() =>
  z.object({
    libraryImportEnabled: z.boolean(),
    publicSignUpEnabled: z.boolean()
  })
)

export type ApplicationFeatureFlagsDto = z.infer<typeof applicationFeatureFlagsDtoSchema>
