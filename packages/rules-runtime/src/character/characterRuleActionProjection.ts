import type { CharacterResolvedActionMechanic } from '@artificer-toolkit/schema/api/characterActionRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import { activeAttackRollDice } from './activeEffectGrantTotals.js'

import type {
  CharacterSheetProjectedMechanic,
  CharacterSheetProjectedOutcome
} from './characterSheetMechanic.js'

export interface CharacterRuleActionPresentationReferences {
  conditionLabels: ReadonlyMap<string, string>
  damageLabels: ReadonlyMap<string, string>
}

function projectOutcome(
  outcome: CharacterResolvedActionMechanic['outcomes'][number],
  references: CharacterRuleActionPresentationReferences
): CharacterSheetProjectedOutcome {
  switch (outcome.kind) {
    case 'DAMAGE': {
      const damageTypeLabel = references.damageLabels.get(outcome.damageTypeId)
      if (!damageTypeLabel) {
        throw new Error(`Character rule action damage type is missing: ${outcome.damageTypeId}`)
      }
      return {
        kind: outcome.kind,
        pathCode: outcome.pathCode,
        expression: outcome.expression,
        damageTypeId: outcome.damageTypeId,
        damageTypeLabel,
        ...(outcome.scaling.length > 0 ? { scaling: outcome.scaling } : {})
      }
    }
    case 'HEAL':
      return {
        kind: outcome.kind,
        pathCode: outcome.pathCode,
        expression: outcome.expression,
        temporary: outcome.temporary,
        ...(outcome.scaling.length > 0 ? { scaling: outcome.scaling } : {})
      }
    case 'CONDITION': {
      const label = references.conditionLabels.get(outcome.conditionId)
      if (!label) {
        throw new Error(`Character rule action condition is missing: ${outcome.conditionId}`)
      }
      return {
        kind: outcome.kind,
        pathCode: outcome.pathCode,
        conditionId: outcome.conditionId,
        label
      }
    }
    case 'EFFECT':
      return {
        kind: outcome.kind,
        pathCode: outcome.pathCode,
        effectKind: outcome.effectKind,
        ...(outcome.label === null ? {} : { label: outcome.label }),
        ...(outcome.spellSlotExchange ? { spellSlotExchange: outcome.spellSlotExchange } : {})
      }
  }
}

export function projectCharacterRuleActionMechanic(
  mechanic: CharacterResolvedActionMechanic,
  references: CharacterRuleActionPresentationReferences,
  /** The Character's active effects; their attack-roll dice join the row as the room rolls them. */
  activeEffects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): CharacterSheetProjectedMechanic {
  const attackAddedDice =
    mechanic.attackDomain === null
      ? []
      : activeAttackRollDice(activeEffects, mechanic.attackDomain, mechanic.attackAbility)
  return {
    effectId: mechanic.effectId,
    trigger: mechanic.trigger,
    ...(mechanic.activation === null ? {} : { activation: mechanic.activation }),
    ...(mechanic.rangeLabel === null ? {} : { rangeLabel: mechanic.rangeLabel }),
    ...(mechanic.attackBonus === null ? {} : { attackBonus: mechanic.attackBonus }),
    ...(attackAddedDice.length > 0 ? { attackAddedDice } : {}),
    ...(mechanic.attackRollMode === null ? {} : { attackRollMode: mechanic.attackRollMode }),
    ...(mechanic.save === null
      ? {}
      : {
          save: {
            ability: mechanic.save.ability,
            ...(mechanic.save.dc === null ? {} : { dc: mechanic.save.dc })
          }
        }),
    ...(mechanic.targetCountLevels ? { targetCountLevels: mechanic.targetCountLevels } : {}),
    outcomes: mechanic.outcomes.map((outcome) => projectOutcome(outcome, references))
  }
}
