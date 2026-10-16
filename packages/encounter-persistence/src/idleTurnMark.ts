import {
  encounterActorIdleTurnMark,
  withEncounterActorIdleTurnMark,
  type EncounterIdleTurnMark
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { effectsEndedBy } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActor, replaceRunActor } from './documents.js'
import type { EncounterWriteContext } from './store.js'

/** Every site where an actor attacks a hostile creature or takes damage marks it through this. */
export function engageIdleTurnActor(actor: EncounterRunActorState): EncounterRunActorState {
  return encounterActorIdleTurnMark(actor) === 'ARMED'
    ? encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterActorIdleTurnMark(actor, 'ENGAGED')
      })
    : actor
}

/** Marks a stored actor that just took damage outside an action, such as at the Sheet. */
export async function engageStoredIdleTurnActor(
  ctx: EncounterWriteContext,
  state: EncounterRunState,
  actorId: string
) {
  const actor = await readRunActor(ctx, state, actorId)
  const engaged = engageIdleTurnActor(actor)
  if (engaged !== actor) await replaceRunActor(ctx, actor, engaged)
}

/**
 * Arms an actor that was just given a grant that ends on an idle turn. A grant that starts on its
 * holder's own turn skips that turn's check: the holder arrives engaged, so the first check is at
 * the end of its next turn.
 */
export function armIdleTurnActor(input: {
  actor: EncounterRunActorState
  createdEffects: readonly ActiveRuleEffectRecord[]
  currentActorId: string | null
}): EncounterRunActorState {
  const { actor } = input
  if (
    encounterActorIdleTurnMark(actor) !== null ||
    effectsEndedBy(input.createdEffects, 'ON_IDLE_TURN').length === 0
  )
    return actor
  return encounterRunActorStateSchema.parse({
    ...actor,
    resources: withEncounterActorIdleTurnMark(
      actor,
      actor.id === input.currentActorId ? 'ENGAGED' : 'ARMED'
    )
  })
}

/** The marks a commit changed with the mark each held before, so the action's undo can restore them. */
export function idleTurnMarkChanges(
  before: readonly EncounterRunActorState[],
  after: readonly EncounterRunActorState[]
): { actorId: string; before: EncounterIdleTurnMark | null }[] {
  const afterById = new Map(after.map((actor) => [actor.id, actor] as const))
  return before.flatMap((actor) => {
    const mark = encounterActorIdleTurnMark(actor)
    const settled = afterById.get(actor.id)
    return settled && encounterActorIdleTurnMark(settled) !== mark
      ? [{ actorId: actor.id, before: mark }]
      : []
  })
}
