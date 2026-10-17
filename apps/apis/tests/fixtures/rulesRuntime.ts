import { createReusableDefinitionRuntimeSource } from '@artificer-toolkit/authoring/reusableDefinitions'
import { createPlatformRulesRuntime } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { MutationCtx } from '../../convex/_generated/server'
import { createConvexReusableDefinitionStore } from '../../convex/content/definitionStore'

/** A rules runtime over the test transaction's definitions, for seeding sealed rule evidence. */
export function createRulesRuntime(ctx: MutationCtx, userId: string) {
  return createPlatformRulesRuntime({
    definitions: createReusableDefinitionRuntimeSource(
      createConvexReusableDefinitionStore(ctx, userId)
    )
  })
}
