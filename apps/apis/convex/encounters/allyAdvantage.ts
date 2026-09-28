import type { EncounterAllyAdvantageUseDto } from '@artificer-toolkit/schema/shared/basicActions'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { withoutEncounterAllyAdvantage } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import type { MutationCtx } from '../_generated/server'
import { replaceRunActor } from '@artificer-toolkit/encounter-persistence/documents'

/**
 * Records the ally advantages (Help, Q11) a committed roll used: each leaves its helper. Only the
 * roll's own participants (`rollerActorIds`) can have used one.
 */
export async function consumeEncounterAllyAdvantages(
  ctx: MutationCtx,
  input: {
    actors: readonly EncounterRunActorState[]
    uses: readonly EncounterAllyAdvantageUseDto[]
    rollerActorIds: readonly string[]
  }
): Promise<EncounterRunActorState[]> {
  let actors = [...input.actors]
  for (const use of input.uses) {
    const helper = actors.find((actor) => actor.id === use.helperActorId)
    if (
      !helper ||
      use.effect.allyActorId === null ||
      !input.rollerActorIds.includes(use.effect.allyActorId)
    )
      throw new Error('Encounter ally advantage scope mismatch.')
    const helped = withoutEncounterAllyAdvantage(helper, use.effect)
    await replaceRunActor(ctx, helper, helped)
    actors = actors.map((actor) => (actor.id === helped.id ? helped : actor))
  }
  return actors
}
