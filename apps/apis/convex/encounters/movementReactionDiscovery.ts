import { discoverEncounterMovementReactionChoices } from '@artificer-toolkit/rules-runtime/encounterMovementReactionDiscovery'
import type { MutationCtx } from '../_generated/server'
import type { MovementTarget } from './movementTargets'
import { createRulesRuntime } from '../rules/runtime'
import { loadNativeMovementReactionSources } from './movementReactionFacts'

/** Adds the execution runtime only for discovery/validation that executes System graphs. */
export async function loadNativeMovementReactionFacts(
  ctx: MutationCtx,
  input: { encounterId: string; expectedEncounterVersion: number },
  movementTargets?: ReadonlyMap<string, MovementTarget>
) {
  const facts = await loadNativeMovementReactionSources(ctx, input, movementTargets)
  return { ...facts, runtime: await createRulesRuntime(ctx, facts.userId) }
}
/** The Scene coordinator supplies perception from its authoritative frozen geometry, not a client flag. */
export async function discoverNativeMovementReactions(
  ctx: MutationCtx,
  input: Pick<
    Parameters<typeof discoverEncounterMovementReactionChoices>[0],
    | 'grid'
    | 'movementKind'
    | 'movingTokenId'
    | 'occurrenceId'
    | 'path'
    | 'actorIdByTokenId'
    | 'tokens'
    | 'resolvePerception'
  > & { encounterId: string; expectedEncounterVersion: number }
) {
  return discoverEncounterMovementReactionChoices({
    ...input,
    ...(await loadNativeMovementReactionFacts(ctx, input))
  })
}
