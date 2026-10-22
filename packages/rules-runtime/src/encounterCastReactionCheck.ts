import {
  SPELLCASTING_ABILITY_REFERENCE,
  type AbilityModifierReference
} from '@artificer-toolkit/shared/core'
import { resolveAbilityAlias } from '@artificer-toolkit/shared/character'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

import { freezeD20Context } from './encounterD20Settlement.js'
import { EncounterValidationError } from './encounterErrors.js'
import { actorContestFacts } from './encounterMovementPassagePreparation.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'

/** The check an authored reaction asks of its reactor before it may counter a higher-level cast. */
export type CastReactionLevelCheck = {
  ability: AbilityModifierReference
  baseDc: number
}

/** What the reactor rolls once the cast's level is known: the ability it rolls with and the DC. */
export type CastReactionCheckRequirement = {
  ability: AbilityModifierReference
  dc: number
}

/**
 * The check a counter owes for a cast: none unless the reaction authors a check and the cast is cast
 * above the level the counter is cast at. The DC is the authored base plus the cast's level.
 */
export function castReactionCheckRequirement(input: {
  higherLevelCheck: CastReactionLevelCheck | undefined
  counterLevel: number
  triggerLevel: number
}): CastReactionCheckRequirement | null {
  const { higherLevelCheck } = input
  if (!higherLevelCheck || input.triggerLevel <= input.counterLevel) return null
  return { ability: higherLevelCheck.ability, dc: higherLevelCheck.baseDc + input.triggerLevel }
}

/**
 * The ability a reactor rolls a counter's check with, or undefined when it has none to roll. SPELLCASTING
 * is the ability the reactor casts with.
 */
export function castReactionCheckAbility(
  requirement: CastReactionCheckRequirement,
  reactor: Pick<MovementTarget, 'characterFacts' | 'effectiveRulePolicyOutput'>
): string | undefined {
  if (!reactor.characterFacts) return undefined
  return requirement.ability === SPELLCASTING_ABILITY_REFERENCE
    ? reactor.effectiveRulePolicyOutput?.derivedStats.spellcasting?.abilityId
    : requirement.ability
}

/**
 * Freezes the reactor's d20 for a counter's check: its modifier, contributors and roll mode for the
 * ability the reaction names, conditions and active grants included. A reactor with no such ability has
 * no check to make.
 */
export function prepareEncounterCastReactionCheck<
  TCharacterFacts extends CharacterMovementFacts
>(input: {
  requirement: CastReactionCheckRequirement
  gameSystemId: string
  system: SystemAuthoredDto
  reactor: MovementTarget<TCharacterFacts>
}) {
  const { reactor, requirement } = input
  const facts = reactor.characterFacts
  const ability = castReactionCheckAbility(requirement, reactor)
  if (!facts || ability === undefined)
    throw new EncounterValidationError('The reacting creature has no ability for the check.')
  const canonical = resolveAbilityAlias(ability) ?? ability
  const definition = facts.ruleEvaluation.facts.abilityDefinitions.find(
    ({ code }) => (resolveAbilityAlias(code) ?? code) === canonical
  )
  if (!definition) throw new EncounterValidationError('The System has no such ability to check.')
  const d20 = actorContestFacts({
    actorId: reactor.actor.id,
    checkKind: 'ABILITY',
    checkDefinitionId: definition.id,
    gameSystemId: input.gameSystemId,
    system: input.system,
    targets: new Map([[reactor.actor.id, reactor]])
  })
  if (d20.modifier === null)
    throw new EncounterValidationError('The reacting creature has no total for the check.')
  return {
    checkDefinitionId: definition.id,
    d20: freezeD20Context({
      gameSystemId: input.gameSystemId,
      rollMode: d20.rollMode,
      contributors: d20.contributors,
      modifier: d20.modifier
    })
  }
}
