import type {
  DurationAuthored,
  EffectAuthored,
  OutcomeAuthored
} from '@artificer-toolkit/shared/authored'
import { createTargeting } from '#app/forms/rendering/authoringNodeDefaults'
import type { GuidedEffectIds, GuidedSpellDraft } from './guidedSimpleEffect.types'

export function mapGuidedSpellEffect(
  draft: GuidedSpellDraft,
  baseEffect: EffectAuthored,
  ids: GuidedEffectIds
): EffectAuthored {
  const path = baseEffect.paths[0]
  if (!path || path.selectionKind !== 'FIXED') {
    throw new Error('Guided spell effects require a fixed path.')
  }

  const range =
    draft.target === 'SELF'
      ? { id: baseEffect.invocation.range.id, rangeKind: 'SELF' as const }
      : {
          id: baseEffect.invocation.range.id,
          rangeKind: 'DISTANCE' as const,
          amount: draft.targetDistance,
          unit: 'FEET' as const
        }
  const targeting =
    draft.target === 'SELF' ? createTargeting('SELF') : createTargeting('CHOSEN_CREATURES')
  const invocation = draft.saveAbilityDefinitionId
    ? {
        kind: 'ACTION' as const,
        triggerCode: 'SAVING_THROW' as const,
        savingThrow: {
          id: ids.savingThrowId,
          dcMethod: 'SOURCE_SAVE_DC' as const,
          abilityDefinitionId: draft.saveAbilityDefinitionId
        },
        activation: { code: 'ACTION' as const, amount: 1 },
        range,
        targeting
      }
    : {
        kind: 'ACTION' as const,
        triggerCode: 'ACTIVATED' as const,
        activation: { code: 'ACTION' as const, amount: 1 },
        range,
        targeting
      }

  const outcome = createOutcome(draft, ids.outcomeId)
  const duration =
    draft.intent === 'CONDITION'
      ? createConditionDuration(draft.conditionDuration, ids.durationId)
      : undefined
  const resultBlock = { ...path.resultBlock }
  delete resultBlock.duration

  return {
    ...baseEffect,
    invocation,
    paths: [
      {
        ...path,
        resultBlock: {
          ...resultBlock,
          ...(duration ? { duration } : {}),
          outcomes: [outcome]
        }
      }
    ]
  }
}

function createOutcome(draft: GuidedSpellDraft, id: string): OutcomeAuthored {
  switch (draft.intent) {
    case 'DAMAGE':
      return {
        id,
        effectKind: 'DAMAGE' as const,
        damageTypeId: draft.damageTypeId,
        diceConfig: draft.damageDice,
        valueKind: 'DICE' as const,
        scalingKind: 'NONE' as const
      }
    case 'CONDITION':
      return {
        id,
        effectKind: 'CONDITION' as const,
        conditionId: draft.conditionTypeId
      }
    case 'HEALING':
      return {
        id,
        effectKind: 'HEAL' as const,
        diceConfig: draft.healingDice,
        valueKind: 'DICE' as const,
        scalingKind: 'NONE' as const,
        temporary: draft.temporaryHealing
      }
    case 'MOVEMENT':
      return {
        id,
        effectKind: 'FORCED_MOVEMENT' as const,
        direction: draft.movementDirection,
        actionEconomy: 'NONE' as const,
        distanceMode: 'EXACT' as const,
        amount: draft.movementAmount,
        unit: 'FEET' as const
      }
  }
}

function createConditionDuration(
  duration: GuidedSpellDraft['conditionDuration'],
  id: string
): DurationAuthored {
  switch (duration) {
    case 'INSTANTANEOUS':
      return { id, durationKind: 'INSTANTANEOUS' as const }
    case 'UNTIL_DISPELLED':
      return { id, durationKind: 'UNTIL_DISPELLED' as const }
    case 'MINUTE':
      return { id, durationKind: 'MINUTE' as const, amount: 1 }
    case 'ROUND':
      return { id, durationKind: 'ROUND' as const, amount: 1 }
  }
}
