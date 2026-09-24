import {
  resolveEncounterActionSource,
  type EncounterActionSourceInput,
  type NativeEncounterActionSource
} from '@artificer-toolkit/rules-runtime/encounterActionSources'
import type { QueryCtx } from '../_generated/server'
import { requireSystem } from '../content/systemDocuments'

export type { NativeEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'

/** Resolves an action from current authoritative sources, never caller mechanics. */
export async function loadNativeEncounterActionSource(
  ctx: QueryCtx,
  input: Omit<EncounterActionSourceInput, 'system'>
): Promise<NativeEncounterActionSource> {
  if (input.actor.systemId !== input.gameSystemId)
    throw new Error('Encounter action source does not match the Encounter Game System.')
  const system =
    input.actor.kind === 'CREATURE' ? await requireSystem(ctx, input.gameSystemId) : undefined
  return resolveEncounterActionSource({ ...input, system })
}
