import type { CharacterSheetMechanicsQueryResult } from '@artificer-toolkit/db'
import type { CharacterResolvedActionMechanic } from '@artificer-toolkit/schema/api/characterActionRules'

import type {
  CharacterSheetProjectedMechanic,
  CharacterSheetProjectedOutcome
} from './characterSheetMechanic.js'

function projectOutcome(
  outcome: CharacterResolvedActionMechanic['outcomes'][number],
  damageLabels: ReadonlyMap<string, string>,
  conditionLabels: ReadonlyMap<string, string>
): CharacterSheetProjectedOutcome {
  switch (outcome.kind) {
    case 'DAMAGE': {
      const damageTypeLabel = damageLabels.get(outcome.damageTypeId)
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
      const label = conditionLabels.get(outcome.conditionId)
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
        ...(outcome.label === null ? {} : { label: outcome.label })
      }
  }
}

export function projectCharacterRuleActionMechanic(
  mechanic: CharacterResolvedActionMechanic,
  query: CharacterSheetMechanicsQueryResult
): CharacterSheetProjectedMechanic {
  const damageLabels = new Map(
    query.damages.map((damage) => [damage.damageTypeId, damage.damageTypeLabel] as const)
  )
  const conditionLabels = new Map(
    query.conditions.map(
      (condition) => [condition.conditionTypeId, condition.conditionTypeLabel] as const
    )
  )

  return {
    effectId: mechanic.effectId,
    trigger: mechanic.trigger,
    ...(mechanic.activation === null ? {} : { activation: mechanic.activation }),
    ...(mechanic.rangeLabel === null ? {} : { rangeLabel: mechanic.rangeLabel }),
    ...(mechanic.attackBonus === null ? {} : { attackBonus: mechanic.attackBonus }),
    ...(mechanic.attackRollMode === null ? {} : { attackRollMode: mechanic.attackRollMode }),
    ...(mechanic.save === null
      ? {}
      : {
          save: {
            ability: mechanic.save.ability,
            ...(mechanic.save.dc === null ? {} : { dc: mechanic.save.dc })
          }
        }),
    outcomes: mechanic.outcomes.map((outcome) =>
      projectOutcome(outcome, damageLabels, conditionLabels)
    )
  }
}
