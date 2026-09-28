import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  lockedRelationshipActionFacts,
  type EncounterRelationshipD20Contributor
} from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'

import type { QueryCtx } from '../_generated/server'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'

/** Loads every current Run actor's effects before preparing relationship-bound action facts. */
export async function loadNativeActionRelationshipFacts(
  ctx: QueryCtx,
  input: {
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    sourceActorId: string
    targetActorId: string
    actionEffectId: string
    activeEffectsByActorId?: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  }
): Promise<readonly EncounterRelationshipD20Contributor[]> {
  const expectedActorIds = new Set(input.state.actorIds)
  if (
    expectedActorIds.size !== input.state.actorIds.length ||
    input.actors.length !== expectedActorIds.size ||
    new Set(input.actors.map((actor) => actor.id)).size !== input.actors.length ||
    input.actors.some(
      (actor) => actor.encounterId !== input.state.id || !expectedActorIds.has(actor.id)
    ) ||
    !expectedActorIds.has(input.sourceActorId) ||
    !expectedActorIds.has(input.targetActorId)
  )
    throw new Error('Encounter actor state does not match the Run.')
  if (input.actors.some((actor) => actor.kind === 'CHARACTER' && !actor.sourceId))
    throw new Error('Encounter Character actor source is unavailable.')

  const activeEffectsByActorId = new Map(
    await Promise.all(
      input.actors.map(
        async (actor) =>
          [
            actor.id,
            input.activeEffectsByActorId?.get(actor.id) ??
              (await listActiveRuleEffects(
                ctx,
                actor.kind === 'CHARACTER'
                  ? { kind: 'CHARACTER', characterId: actor.sourceId! }
                  : {
                      kind: 'ENCOUNTER_ACTOR',
                      encounterId: input.state.id,
                      targetActorId: actor.id
                    }
              ))
          ] as const
      )
    )
  )
  return lockedRelationshipActionFacts({
    actionEffectId: input.actionEffectId,
    sourceActorId: input.sourceActorId,
    targetActorId: input.targetActorId,
    targets: { activeEffectsByActorId }
  })
}
