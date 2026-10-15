import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'

import type { MovementTarget } from './encounterMovementTargets.js'

/**
 * The reactions a Character holds that answer being attacked: authored `ATTACKED_SELF` reactions among
 * its actions and the spells it may cast now. Whether one is affordable is decided when it is prepared.
 */
export function discoverAttackReactionActions(
  target: Pick<MovementTarget, 'characterReactionSource' | 'characterSpellCast'>
): readonly Pick<CharacterActionCandidate, 'actionId' | 'effectId'>[] {
  const candidates: readonly CharacterActionCandidate[] = [
    ...(target.characterReactionSource?.mechanics.rulePolicyInput.actionCandidates ?? []),
    ...(target.characterSpellCast?.candidates ?? [])
  ]
  return candidates
    .filter(({ mechanicFacts: { invocation } }) => {
      return (
        invocation.reactionTrigger?.kind === 'ATTACKED_SELF' &&
        invocation.activation?.code === 'REACTION'
      )
    })
    .map(({ actionId, effectId }) => ({ actionId, effectId }))
    .sort((left, right) => left.actionId.localeCompare(right.actionId))
}
