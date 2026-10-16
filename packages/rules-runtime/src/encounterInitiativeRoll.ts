import type { InitiativeActorFactSource } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import { initiativeRollExpression } from './encounterRuleCheckRolls.js'

/**
 * One actor's initiative roll as made (SRD 5.1): 1d20 plus its initiative modifier, rolled with the
 * Character's initiative roll mode (advantage from Feral Instinct, for example). A Creature rolls
 * normally, and a custom actor has no automatic roll, so it reads as a bare normal d20.
 */
export function readInitiativeSourceRoll(source: InitiativeActorFactSource) {
  switch (source.kind) {
    case 'CHARACTER': {
      const policy = source.effectiveRulePolicyOutput ?? source.overlay.rulePolicyOutput
      const modifier = policy.derivedStats.initiative.effective
      return {
        characterId: source.characterId,
        modifier,
        expression: initiativeRollExpression(20, modifier),
        rollMode: policy.rollModes.initiative
      }
    }
    case 'CREATURE': {
      const modifier = source.actorRule.initiativeModifier
      return {
        characterId: null,
        modifier,
        expression: initiativeRollExpression(20, modifier),
        rollMode: 'NORMAL' as const
      }
    }
    case 'CUSTOM':
      return {
        characterId: null,
        modifier: 0,
        expression: initiativeRollExpression(20, 0),
        rollMode: 'NORMAL' as const
      }
  }
}
