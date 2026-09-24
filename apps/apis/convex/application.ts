import { applicationFeatureFlagsDtoSchema } from '@artificer-toolkit/schema/api/applicationConfig'
import { v } from 'convex/values'
import { query } from './_generated/server'

export function readApplicationFeatureFlags() {
  return applicationFeatureFlagsDtoSchema.parse({
    libraryImportEnabled: process.env.LIBRARY_IMPORT_ENABLED === 'true',
    publicSignUpEnabled: process.env.PUBLIC_SIGN_UP_ENABLED === 'true'
  })
}

export const featureFlags = query({
  args: {},
  returns: v.object({
    libraryImportEnabled: v.boolean(),
    publicSignUpEnabled: v.boolean()
  }),
  handler: readApplicationFeatureFlags
})
