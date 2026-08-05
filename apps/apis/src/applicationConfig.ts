import {
  applicationFeatureFlagsDtoSchema,
  type ApplicationFeatureFlagsDto
} from '@artificer-toolkit/schema/api/applicationConfig'

const libraryImportEnabledEnvKey = 'LIBRARY_IMPORT_ENABLED'
const publicSignUpEnabledEnvKey = 'PUBLIC_SIGN_UP_ENABLED'
const runtimeGlobals = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}

export function parseEnabledFeatureFlag(value: string | undefined): boolean {
  return value === 'true'
}

export function getApplicationFeatureFlags(
  environment: Record<string, string | undefined> = runtimeGlobals.process?.env ?? {}
): ApplicationFeatureFlagsDto {
  return applicationFeatureFlagsDtoSchema.parse({
    libraryImportEnabled: parseEnabledFeatureFlag(environment[libraryImportEnabledEnvKey]),
    publicSignUpEnabled: parseEnabledFeatureFlag(environment[publicSignUpEnabledEnvKey])
  })
}
