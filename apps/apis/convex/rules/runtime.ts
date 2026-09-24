import { createReusableDefinitionRuntimeSource } from '@artificer-toolkit/authoring/reusableDefinitions'
import { createPlatformRulesRuntime } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { MutationCtx } from '../_generated/server'
import { createConvexReusableDefinitionStore } from '../content/definitionStore'

export async function createRulesRuntime(ctx: MutationCtx, userId: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not configured.')
  return createPlatformRulesRuntime({
    continuationIntegrityKey: new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`artificer-toolkit:session-host:rules-continuation:v1\0${secret}`)
      )
    ),
    definitions: createReusableDefinitionRuntimeSource(
      createConvexReusableDefinitionStore(ctx, userId)
    )
  })
}
