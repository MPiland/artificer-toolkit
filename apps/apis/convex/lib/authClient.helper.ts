import { createClient, type AuthFunctions } from '@convex-dev/better-auth'
import { components, internal } from '../_generated/api'
import type { DataModel } from '../_generated/dataModel'
import authSchema from '../betterAuth/schema'

const authFunctions: AuthFunctions = internal.auth

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  local: { schema: authSchema },
  authFunctions,
  // The adapter uses these keys to forward lifecycle events to auth.ts.
  triggers: {
    user: {
      onCreate: async () => undefined,
      onUpdate: async () => undefined,
      onDelete: async () => undefined
    }
  }
})
