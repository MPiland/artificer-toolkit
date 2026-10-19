import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'

import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import { characterReactionCandidates } from './encounterAttackReactionDiscovery.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { dnd5eAttackKind, isDnd5eSpellAttackKind } from './systems/dnd5e/attackKind.js'

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
  return characterReactionCandidates(reactor).flatMap<CastReactionAction>(
    ({ actionId, effectId, mechanicFacts: { invocation, outcomes } }) =>
      invocation.activation?.code === 'REACTION' &&
      invocation.reactionTrigger?.kind === 'SPELL_CAST' &&
      outcomes.some(
        (outcome) => outcome.kind === 'EFFECT' && outcome.effectKind === 'CANCEL_TRIGGERING_EVENT'
      )
        ? [{ actionId, effectId, range: invocation.range }]
        : []
  )
}

/**
 * The reactions a Character holds that answer being chosen as a target of a cast: authored
 * `TARGETED_SELF` reactions, among its actions and the spells it may cast now. One limited to
 * `sourceEffectIds` answers only a cast of one of those spells (`castOwnerId`); absent or empty, any
 * cast. Whether one is affordable is decided when it is prepared.
 */
export function discoverTargetedSelfReactionActions(
  reactor: Pick<MovementTarget, 'characterReactionSource' | 'characterSpellCast'>,
  castOwnerId: string
): readonly Pick<CharacterActionCandidate, 'actionId' | 'effectId'>[] {
  return characterReactionCandidates(reactor).flatMap(
    ({ actionId, effectId, mechanicFacts: { invocation } }) => {
      const trigger = invocation.reactionTrigger
      return invocation.activation?.code === 'REACTION' &&
        trigger?.kind === 'TARGETED_SELF' &&
        (!trigger.sourceEffectIds?.length || trigger.sourceEffectIds.includes(castOwnerId))
        ? [{ actionId, effectId }]
        : []
    }
  )
}

/**
 * The level a prepared spell cast is cast at (0 for a cantrip); null when the action is not a spell
 * cast, so nothing can counter it. A Character's is the level of its cast. A Creature capability's is
 * its authored cast level; a spell attack casts no spell (D136).
 */
export function preparedSpellCastLevel(
  prepared: Pick<
    Awaited<ReturnType<typeof prepareEncounterActionMechanics>>,
    'source' | 'characterActionState'
  >
): number | null {
  if (prepared.source.kind === 'CREATURE') {
    return prepared.source.capability.spellCast?.castLevel ?? null
  }
  if (
    prepared.source.kind !== 'CHARACTER_ACTION' ||
    prepared.source.candidate.mechanicsOwner.kind !== 'SPELL'
  )
    return null
  return prepared.characterActionState?.actionMechanic.spellCastLevel ?? null
}

/**
 * Whether the prepared action is a spell cast, the fact `ON_CAST_SPELL` ends effects on. A Character
 * casts a spell; a Creature casts one when its action is triggered by a spell attack.
 */
export function preparedCastsSpell(
  prepared: Pick<
    Awaited<ReturnType<typeof prepareEncounterActionMechanics>>,
    'source' | 'characterActionState'
  >
): boolean {
  if (preparedSpellCastLevel(prepared) !== null) return true
  if (prepared.source.kind !== 'CREATURE') return false
  const { capability } = prepared.source
  return (
    capability.spellCast != null ||
    isDnd5eSpellAttackKind(dnd5eAttackKind(capability.mechanicFacts.invocation.triggerCode))
  )
}
