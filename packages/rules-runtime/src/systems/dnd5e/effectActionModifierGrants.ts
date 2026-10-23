import { compileModifierGrant, type CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { conditionDurationTurns } from './effectActionFollowUp.js'
import { UUID, DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION } from './effectActionContracts.js'
import { canonicalEndTriggers } from './effectActionBandConditions.js'
import { buildCharacterGrantFoldModifierFacts } from '../../character/characterGrantFoldSourceFacts.js'
import { dnd5eResultGate } from './effectActionOperationRegistry.js'
import type { Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'
import {
  isGrantConsumeEvent,
  isGrantEndEvent,
  GRANT_END_TRIGGER_EVENTS,
  maintenancePlan
} from './effectActionLifetime.js'

type SlotLevelAmount = {
  valueKind: 'SPELL_SLOT_LEVEL'
  multiplier?: number
  subtractLevels?: number
  levelsPerStep?: number
  maximum?: number
}

function isSlotLevelAmount(payload: unknown): payload is SlotLevelAmount {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'valueKind' in payload &&
    payload.valueKind === 'SPELL_SLOT_LEVEL'
  )
}

/**
 * A granted amount that scales by slot level (Aid, Absorb Elements) is the fixed amount a cast level
 * gives; a rolled damage die that adds dice per level above its own (Branding Smite) is the fixed
 * count a cast level gives.
 */
function amountAtCastLevel<M extends { payload?: unknown }>(modifier: M, castLevel: number): M {
  const { payload } = modifier
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'countPerCastLevelAbove' in payload &&
    'count' in payload
  ) {
    const { countPerCastLevelAbove, ...die } = payload as {
      count: number
      countPerCastLevelAbove?: { level: number; count: number }
    }
    if (!countPerCastLevelAbove) return { ...modifier, payload: die }
    const extra =
      countPerCastLevelAbove.count * Math.max(0, castLevel - countPerCastLevelAbove.level)
    return { ...modifier, payload: { ...die, count: die.count + extra } }
  }
  if (!isSlotLevelAmount(payload)) return modifier
  return {
    ...modifier,
    payload: {
      valueKind: 'FIXED',
      amount: Math.min(
        payload.maximum ?? Infinity,
        (payload.multiplier ?? 1) *
          Math.floor(
            Math.max(0, castLevel - (payload.subtractLevels ?? 0)) / (payload.levelsPerStep ?? 1)
          )
      )
    }
  }
}

/**
 * The plan of one APPLY_GRANT entry. With `untilEndEvent` the grant has no counted duration and
 * lasts until one of its authored end events (a speed penalty that lasts until the creature
 * regains Hit Points); without it the grant must be timed, and may also end early on an event
 * (Rage ends when its holder is incapacitated).
 */
export function modifierGrantEntryPlan(input: {
  action: Dnd5eCompiledEffectActionSource
  entry: CompiledEffectGroup['entries'][number]
  /** The grant applies only on its authored result path: an attack's hit or a save's failure. */
  resultGated: boolean
  untilEndEvent: boolean
}): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const { action, entry, resultGated, untilEndEvent } = input
  if (!('outcome' in entry) || entry.outcome.effectKind !== 'APPLY_GRANT') return null
  const { grants } = entry.outcome
  const { spellCastLevel } = action
  // As a scaled heal is the row the cast level selects, a slot-scaled amount is fixed by it here.
  const modifiers = (grants.modifiers ?? []).map((modifier) =>
    spellCastLevel === undefined ? modifier : amountAtCastLevel(modifier, spellCastLevel)
  )
  const initialRemaining = entry.duration ? conditionDurationTurns(entry.duration) : null
  const {
    turnAnchor,
    consumeOnFirstEvents = [],
    endOnEvents = [],
    endOnTriggers = [],
    endOnConditionIds = [],
    holderEnd = null,
    fromSourceOnly = false,
    activeOnlyOnFinalAnchorTurn = false,
    uses,
    stepDown,
    onEnd,
    grantedActions,
    effectOffers,
    ...otherLifecycle
  } = entry.lifecycle ?? {}
  const consumeEvents = [...new Set(consumeOnFirstEvents)].sort()
  const endEvents = [...new Set(endOnEvents)].sort()
  const grantConsumeEvents = consumeEvents.filter(isGrantConsumeEvent)
  const grantEndEvents = endEvents.filter(isGrantEndEvent)
  const senses = grants.senses ?? []
  const grantedSenses = senses.flatMap((sense) =>
    sense.selectionKind === 'GRANTED' && sense.scalingKind === 'NONE' && 'senseIds' in sense
      ? [
          {
            grantId: sense.id,
            scalingKind: 'NONE' as const,
            targetIds: [...sense.senseIds],
            levels: [],
            range: { ...sense.range }
          }
        ]
      : []
  )
  if (
    modifiers.length + senses.length + (grantedActions?.length ?? 0) === 0 ||
    grantedSenses.length !== senses.length ||
    modifiers.some(
      ({ payload }) =>
        isSlotLevelAmount(payload) ||
        (typeof payload === 'object' && payload !== null && 'countPerCastLevelAbove' in payload)
    ) ||
    grants.proficiencies?.length ||
    onEnd?.modifiers.some(
      ({ payload }) =>
        isSlotLevelAmount(payload) ||
        (typeof payload === 'object' && payload !== null && 'countPerCastLevelAbove' in payload)
    ) ||
    (untilEndEvent
      ? entry.duration !== undefined ||
        (endEvents.length === 0 && stepDown === undefined) ||
        turnAnchor !== undefined ||
        activeOnlyOnFinalAnchorTurn
      : initialRemaining === null || stepDown !== undefined) ||
    // A step-down grant is only fixed bonuses and penalties: the rests shrink them to nothing.
    (stepDown !== undefined &&
      !modifiers.every(
        ({ modifierKind, payload }) =>
          (modifierKind === 'BONUS' || modifierKind === 'PENALTY') &&
          payload !== undefined &&
          'valueKind' in payload &&
          payload.valueKind === 'FIXED'
      )) ||
    Object.values(otherLifecycle).some((value) => value !== undefined) ||
    grantConsumeEvents.length !== consumeEvents.length ||
    grantEndEvents.length !== endEvents.length ||
    endOnTriggers.some(({ event }) => !GRANT_END_TRIGGER_EVENTS.has(event)) ||
    !UUID.test(entry.entryId)
  )
    return null
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'modifier-grant',
    ...(endOnTriggers.length > 0 && {
      lifecycle: { endOnTriggers: canonicalEndTriggers(endOnTriggers) }
    }),
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: untilEndEvent ? 'NONE' : (turnAnchor?.boundary ?? 'END_OF_TURN'),
    initialRemaining,
    tickAnchor: turnAnchor?.actor === 'SOURCE' ? 'SOURCE' : 'HOLDER',
    modifierGrantContribution: {
      applyGrantOutcomeId: entry.outcome.id,
      modifiers: buildCharacterGrantFoldModifierFacts(modifiers.map(compileModifierGrant)),
      senses: grantedSenses,
      includesCurrentTurn: entry.duration?.durationKind === 'TURN',
      consumeOnFirstEvents: grantConsumeEvents,
      endOnEvents: grantEndEvents,
      endOnConditionIds: [...new Set(endOnConditionIds)].sort(),
      holderEnd,
      ...(fromSourceOnly && { fromSourceOnly: true }),
      ...(activeOnlyOnFinalAnchorTurn && { activeOnlyOnFinalAnchorTurn: true }),
      ...(uses !== undefined && { uses }),
      ...(stepDown && { restStepDown: { ...stepDown } }),
      ...(grantedActions && { grantedActions: grantedActions.map((offer) => ({ ...offer })) }),
      ...(effectOffers && {
        effectOffers: effectOffers.map((offer) =>
          offer.kind === 'MOVE_HELD_EFFECT' ? { ...offer, range: { ...offer.range } } : { ...offer }
        )
      }),
      ...(onEnd && {
        onEnd: {
          turns: onEnd.turns,
          modifiers: buildCharacterGrantFoldModifierFacts(onEnd.modifiers.map(compileModifierGrant))
        }
      })
    },
    ...(resultGated && { resultGate: dnd5eResultGate(entry.pathCode) }),
    adapterFacts: {},
    perceptionContributions: [],
    maintenance: maintenancePlan(action, entry),
    marginRiders: []
  }
}
