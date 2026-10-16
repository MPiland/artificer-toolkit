import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'

import type { MovementTarget } from './encounterMovementTargets.js'

type CastReactionAction = Pick<CharacterActionCandidate, 'actionId' | 'effectId'> & {
  range: CharacterActionCandidate['mechanicFacts']['invocation']['range']
}

/**
 * The reactions a Character holds that answer a creature casting a spell: authored `SPELL_CAST`
 * reactions among its actions and the spells it may cast now. The caller keeps those whose own range
 * reaches the caster; whether one is affordable is decided when it is prepared.
 */
export function discoverCastReactionActions(
  reactor: Pick<MovementTarget, 'characterReactionSource' | 'characterSpellCast'>
): readonly CastReactionAction[] {
  const candidates: readonly CharacterActionCandidate[] = [
    ...(reactor.characterReactionSource?.mechanics.rulePolicyInput.actionCandidates ?? []),
    ...(reactor.characterSpellCast?.candidates ?? [])
  ]
  return candidates
    .flatMap<CastReactionAction>(({ actionId, effectId, mechanicFacts: { invocation } }) =>
      invocation.activation?.code === 'REACTION' &&
      invocation.reactionTrigger?.kind === 'SPELL_CAST'
        ? [{ actionId, effectId, range: invocation.range }]
        : []
    )
    .sort((left, right) => left.actionId.localeCompare(right.actionId))
}
