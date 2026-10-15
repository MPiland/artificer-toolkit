import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'

import type { MovementTarget } from './encounterMovementTargets.js'

/** The damage types an attack deals when it hits, from its authored ON_HIT and ON_CRIT outcomes. */
export function attackHitDamageTypeIds(
  mechanicFacts: Pick<CharacterActionCandidate['mechanicFacts'], 'outcomes'>
): ReadonlySet<string> {
  return new Set(
    mechanicFacts.outcomes.flatMap((outcome) =>
      outcome.kind === 'DAMAGE' && (outcome.pathCode === 'ON_HIT' || outcome.pathCode === 'ON_CRIT')
        ? [outcome.damageTypeId]
        : []
    )
  )
}

/**
 * The reactions a Character holds that answer an attack that hit it: authored `ATTACKED_SELF`
 * reactions, and `DAMAGE_TAKEN` reactions naming a damage type the hit deals, among its actions and
 * the spells it may cast now. Whether one is affordable is decided when it is prepared.
 */
export function discoverAttackReactionActions(
  target: Pick<MovementTarget, 'characterReactionSource' | 'characterSpellCast'>,
  hitDamageTypeIds: ReadonlySet<string>
): readonly (Pick<CharacterActionCandidate, 'actionId' | 'effectId'> & {
  trigger: 'ATTACKED_SELF' | 'DAMAGE_TAKEN'
})[] {
  const candidates: readonly CharacterActionCandidate[] = [
    ...(target.characterReactionSource?.mechanics.rulePolicyInput.actionCandidates ?? []),
    ...(target.characterSpellCast?.candidates ?? [])
  ]
  return candidates
    .flatMap(({ actionId, effectId, mechanicFacts: { invocation } }) => {
      const trigger = invocation.reactionTrigger
      if (invocation.activation?.code !== 'REACTION' || !trigger) return []
      if (
        trigger.kind === 'ATTACKED_SELF' ||
        (trigger.kind === 'DAMAGE_TAKEN' &&
          trigger.damageTypeIds.some((damageTypeId) => hitDamageTypeIds.has(damageTypeId)))
      )
        return [{ actionId, effectId, trigger: trigger.kind }]
      return []
    })
    .sort((left, right) => left.actionId.localeCompare(right.actionId))
}
