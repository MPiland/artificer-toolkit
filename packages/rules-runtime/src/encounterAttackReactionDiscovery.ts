import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterReactionPinDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

import { systemAbilityDefinitions } from './encounterActionSources.js'
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

type AttackReactionAction = Pick<CharacterActionCandidate, 'actionId' | 'effectId'> & {
  trigger: EncounterReactionPinDto['trigger']
  triggerDamageTypeIds: readonly string[]
}

/** What a hit attack is, as the reactions its target holds read it. */
export type AttackReactionHit = {
  damageTypeIds: ReadonlySet<string>
  melee: boolean
  reactorSeesAttacker: boolean
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
 * snapshot as its own turn reads them, or a Character's own listing.
 */
export function encounterReactorCandidates(input: {
  actor: EncounterRunActorState
  target: Pick<MovementTarget, 'characterReactionSource' | 'characterSpellCast'>
  system: SystemAuthoredDto
}): readonly Pick<CharacterActionCandidate, 'actionId' | 'effectId' | 'mechanicFacts'>[] {
  if (input.actor.kind !== 'CREATURE') return characterReactionCandidates(input.target)
  return discoverEncounterFeatureActions({
    actor: input.actor,
    conditionDefinitionIds: input.system.conditionTypes.map(({ id }) => id),
    abilityDefinitions: systemAbilityDefinitions(input.system)
  }).available
}

/**
 * The reactions among a creature's actions that answer an attack that hit it: authored
 * `ATTACKED_SELF` reactions whose qualifiers the attack meets (a melee attack, an attacker the reactor
 * sees), and `DAMAGE_TAKEN` reactions naming a damage type the hit deals. A `DAMAGE_TAKEN` reaction
 * also names the damage types that triggered it (those it names that the hit deals). Whether one is
 * affordable is decided when it is prepared.
 */
export function discoverAttackReactionActions(
  candidates: readonly Pick<CharacterActionCandidate, 'actionId' | 'effectId' | 'mechanicFacts'>[],
  hit: AttackReactionHit
): readonly AttackReactionAction[] {
  return candidates.flatMap<AttackReactionAction>(
    ({ actionId, effectId, mechanicFacts: { invocation } }) => {
      const trigger = invocation.reactionTrigger
      if (invocation.activation?.code !== 'REACTION' || !trigger) return []
      if (trigger.kind === 'ATTACKED_SELF')
        return (trigger.attackRange !== 'MELEE' || hit.melee) &&
          (!trigger.requiresSight || hit.reactorSeesAttacker)
          ? [{ actionId, effectId, trigger: trigger.kind, triggerDamageTypeIds: [] }]
          : []
      if (trigger.kind !== 'DAMAGE_TAKEN') return []
      const triggerDamageTypeIds = trigger.damageTypeIds.filter((damageTypeId) =>
        hit.damageTypeIds.has(damageTypeId)
      )
      return triggerDamageTypeIds.length > 0
        ? [{ actionId, effectId, trigger: trigger.kind, triggerDamageTypeIds }]
        : []
    }
  )
}
