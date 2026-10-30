import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'

import { systemAbilityDefinitions } from './encounterActionSources.js'
import { encounterActorCannotAttack } from './encounterActorBody.js'
import { discoverEncounterFeatureActions } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import type { MovementTarget } from './encounterMovementTargets.js'

/**
 * The damage types an attack deals when it hits, from its authored ON_HIT outcomes and, on a critical
 * hit only, its ON_CRIT outcomes.
 */
export function attackHitDamageTypeIds(
  mechanicFacts: Pick<CharacterActionCandidate['mechanicFacts'], 'outcomes'>,
  critical: boolean
): ReadonlySet<string> {
  return new Set(
    mechanicFacts.outcomes.flatMap((outcome) =>
      outcome.kind === 'DAMAGE' &&
      (outcome.pathCode === 'ON_HIT' || (critical && outcome.pathCode === 'ON_CRIT'))
        ? [outcome.damageTypeId]
        : []
    )
  )
}

/** The actions a Character may react with now, in its own listing order (a spell's casts lowest level first). */
export function characterReactionCandidates(
  target: Pick<MovementTarget, 'characterReactionSource' | 'characterSpellCast'>
): readonly CharacterActionCandidate[] {
  return [
    ...(target.characterReactionSource?.mechanics.rulePolicyInput.actionCandidates ?? []),
    ...(target.characterSpellCast?.candidates ?? [])
  ].sort((left, right) => left.sequence - right.sequence)
}

/**
 * The actions an attacked creature may react with: a Creature's feature actions, read from its
 * snapshot as its own turn reads them, less the attacks its summon says it cannot make, or a
 * Character's own listing.
 */
export function encounterReactorCandidates(input: {
  actor: EncounterRunActorState
  target: Pick<MovementTarget, 'characterReactionSource' | 'characterSpellCast'>
  system: SystemAuthoredDto
  spells: ReadonlyMap<string, CompiledSpell>
}): readonly Pick<CharacterActionCandidate, 'actionId' | 'effectId' | 'mechanicFacts'>[] {
  if (input.actor.kind !== 'CREATURE') return characterReactionCandidates(input.target)
  const { available } = discoverEncounterFeatureActions({
    actor: input.actor,
    conditionDefinitionIds: input.system.conditionTypes.map(({ id }) => id),
    abilityDefinitions: systemAbilityDefinitions(input.system),
    spells: input.spells
  })
  return encounterActorCannotAttack(input.actor)
    ? available.filter((action) => !action.attackMechanic)
    : available
}
