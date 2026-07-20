import { z } from 'zod'

export const applicationFeatureFlagsDtoSchema = z.object({
  publicSignUpEnabled: z.boolean()
})

export type ApplicationFeatureFlagsDto = z.infer<typeof applicationFeatureFlagsDtoSchema>
