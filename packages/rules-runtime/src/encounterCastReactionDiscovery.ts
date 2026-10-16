import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'

import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import type { MovementTarget } from './encounterMovementTargets.js'

type CastReactionAction = Pick<CharacterActionCandidate, 'actionId' | 'effectId'> & {
  range: CharacterActionCandidate['mechanicFacts']['invocation']['range']
}

/**
 * The reactions a Character holds that answer a creature casting a spell: authored `SPELL_CAST`
 * reactions that cancel the cast, among its actions and the spells it may cast now. The caller keeps
 * those whose own range reaches the caster; whether one is affordable is decided when it is prepared.
 */
export function discoverCastReactionActions(
  reactor: Pick<MovementTarget, 'characterReactionSource' | 'characterSpellCast'>
): readonly CastReactionAction[] {
  const candidates: readonly CharacterActionCandidate[] = [
    ...(reactor.characterReactionSource?.mechanics.rulePolicyInput.actionCandidates ?? []),
    ...(reactor.characterSpellCast?.candidates ?? [])
  ]
  return candidates
    .flatMap<CastReactionAction>(
      ({ actionId, effectId, mechanicFacts: { invocation, outcomes } }) =>
        invocation.activation?.code === 'REACTION' &&
        invocation.reactionTrigger?.kind === 'SPELL_CAST' &&
        outcomes.some(
          (outcome) => outcome.kind === 'EFFECT' && outcome.effectKind === 'CANCEL_TRIGGERING_EVENT'
        )
          ? [{ actionId, effectId, range: invocation.range }]
          : []
    )
    .sort((left, right) => left.actionId.localeCompare(right.actionId))
}

/**
 * The level a Character's prepared spell cast is cast at (0 for a cantrip); null when the action is
 * not a Character's spell cast, so nothing can counter it.
 */
export function preparedSpellCastLevel(
  prepared: Pick<
    Awaited<ReturnType<typeof prepareEncounterActionMechanics>>,
    'source' | 'characterActionState'
  >
): number | null {
  if (
    prepared.source.kind !== 'CHARACTER_ACTION' ||
    prepared.source.candidate.mechanicsOwner.kind !== 'SPELL'
  )
    return null
  return prepared.characterActionState?.actionMechanic.spellCastLevel ?? null
}
