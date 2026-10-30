import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { encounterActorRelationship } from './encounterActionTargetPolicy.js'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import { encounterActorCannotAttack } from './encounterActorBody.js'
import { discoverEncounterFeatureActionCapabilities } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import type { EncounterMovementReactionCharacterSource } from './encounterMovementReactionSources.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'

/** Builds reaction discovery facts from an already-authorized Run and target cohort. */
export function buildEncounterMovementReactionFacts<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: {
  state: EncounterRunState
  userId: string
  campaignOwnerUserId: string
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  system: SystemAuthoredDto
  /** The Run's pinned Spells (D163). */
  spells: ReadonlyMap<string, CompiledSpell>
  definitions: CurrentReusableDefinitionSource
}) {
  const { state, targets, system } = input
  if (state.automationMode === 'MANUAL')
    throw new Error('Movement reactions require an Assisted Encounter.')
  const actors = state.actorIds.map((id) => {
    const target = targets.get(id)
    if (
      !target ||
      target.actor.id !== id ||
      target.actor.encounterId !== state.id ||
      target.actor.systemId !== state.gameSystemId
    )
      throw new Error('Projected movement actor does not match the Run.')
    return target.actor
  })
  const lockedCharacters = new Map<string, EncounterMovementReactionCharacterSource>()
  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER') continue
    const source = targets.get(actor.id)?.characterReactionSource
    if (!source || !actor.sourceId || lockedCharacters.has(actor.sourceId))
      throw new Error('Encounter Character reaction source is unavailable or duplicated.')
    lockedCharacters.set(actor.sourceId, source)
  }
  const abilityDefinitions =
    'abilities' in system && Array.isArray(system.abilities)
      ? system.abilities.map(({ id, code }) => ({ id, code }))
      : []
  return {
    userId: input.userId,
    campaignOwnerUserId: input.campaignOwnerUserId,
    targets,
    state,
    encounter: { ...state, actors },
    automationMode: state.automationMode,
    lockedCharacters,
    activeEffectsByActorId: new Map(
      [...targets].map(([actorId, target]) => [actorId, target.activeEffects])
    ),
    encounterFeatureCapabilities: actors.flatMap((actor) =>
      // A creature that cannot attack makes no opportunity attack.
      actor.kind === 'CREATURE' && !encounterActorCannotAttack(actor)
        ? discoverEncounterFeatureActionCapabilities({
            actor,
            conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
            abilityDefinitions,
            spells: input.spells
          })
        : []
    ),
    definitions: input.definitions,
    lockRelationship: async (pair: { reactorActorId: string; movingActorId: string }) => {
      const reactor = actors.find((actor) => actor.id === pair.reactorActorId)
      const moving = actors.find((actor) => actor.id === pair.movingActorId)
      if (!reactor || !moving) return null
      // Disposition is the one source of hostility (ADR 0034, D13).
      return encounterActorRelationship(reactor.disposition, moving.disposition)
    }
  }
}
