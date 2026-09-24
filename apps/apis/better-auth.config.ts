import type { GenericCtx } from '@convex-dev/better-auth'
import { betterAuth } from 'better-auth/minimal'
import { createAuthOptions } from './convex/authFactory.helper'
import type { DataModel } from './convex/_generated/dataModel'

// CLI-only schema discovery. No adapter operation or application handler is executed.
export const auth = betterAuth({
  ...createAuthOptions({} as GenericCtx<DataModel>),
  baseURL: 'http://localhost:3000',
  secret: 'schema-generation-only-not-an-application-secret'
})
