import { compileModifierGrant, type CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type {
  CharacterRuleActionActiveEffectPlan,
  CharacterRuleActionSystemAdapter
} from '../../characterRuleActionSystemAdapter.js'
import { conditionDurationTurns, planTickAnchor } from './effectActionFollowUp.js'
import {
  UUID,
  DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
  unsupported
} from './effectActionContracts.js'
import { canonicalEndTriggers } from './effectActionBandConditions.js'
import { buildCharacterGrantFoldModifierFacts } from '../../character/characterGrantFoldSourceFacts.js'
import { dnd5eResultGate } from './effectActionOperationRegistry.js'
import type { Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'
import {
  durationPublishedGraph,
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
 * (Rage ends when its holder is incapacitated). A `standing` grant is a passive one that lasts until
 * any of its end events, triggers or conditions, and its authored `returnsOn` rest turns it back on.
 */
export function modifierGrantEntryPlan(input: {
  action: Dnd5eCompiledEffectActionSource
  entry: CompiledEffectGroup['entries'][number]
  /** The grant applies only on its authored result path: an attack's hit or a save's failure. */
  resultGated: boolean
  untilEndEvent: boolean
  standing?: boolean
}): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const { action, entry, resultGated, untilEndEvent, standing = false } = input
  if (!('outcome' in entry) || entry.outcome.effectKind !== 'APPLY_GRANT') return null
  const { grants } = entry.outcome
  const { spellCastLevel } = action
  // As a scaled heal is the row the cast level selects, a slot-scaled amount is fixed by it here.
  const modifiers = (grants.modifiers ?? []).map((modifier) =>
    spellCastLevel === undefined ? modifier : amountAtCastLevel(modifier, spellCastLevel)
  )
  // Until dispelled, the grant lasts until an END_EFFECTS outcome or the GM ends it (Fiendish
  // Resilience, replaced by its next use).
  const untilDispelled = entry.duration?.durationKind === 'UNTIL_DISPELLED'
  const initialRemaining =
    entry.duration && !untilDispelled ? conditionDurationTurns(entry.duration) : null
  const {
    turnAnchor,
    consumeOnFirstEvents = [],
    endOnEvents = [],
    endOnTriggers = [],
    endOnConditionIds = [],
    holderEnd = null,
    endsWithHeldEffectId,
    fromSourceOnly = false,
    exclusivity,
    activeOnlyOnFinalAnchorTurn = false,
    uses,
    onEnd,
    grantedActions,
    effectOffers,
    returnsOn,
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
    modifiers.length +
      senses.length +
      (grantedActions?.length ?? 0) +
      (effectOffers?.length ?? 0) ===
      0 ||
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
    standing !== (returnsOn !== undefined) ||
    (untilEndEvent || standing
      ? entry.duration !== undefined ||
        (standing
          ? endEvents.length + endOnTriggers.length + endOnConditionIds.length
          : endEvents.length) === 0 ||
        turnAnchor !== undefined ||
        activeOnlyOnFinalAnchorTurn
      : untilDispelled
        ? turnAnchor !== undefined || activeOnlyOnFinalAnchorTurn
        : initialRemaining === null) ||
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
    recurrenceStage:
      untilEndEvent || standing || untilDispelled
        ? 'NONE'
        : (turnAnchor?.boundary ?? 'END_OF_TURN'),
    initialRemaining,
    ...(endsWithHeldEffectId !== undefined && { endsWithHeldEffectId }),
    tickAnchor: planTickAnchor(turnAnchor),
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
      ...(exclusivity && { exclusivity }),
      ...(activeOnlyOnFinalAnchorTurn && { activeOnlyOnFinalAnchorTurn: true }),
      ...(uses !== undefined && { uses }),
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

/** The timed grant a passive "when this creature takes damage" feature gives its holder. */
export const passiveDamageGrantPlan: NonNullable<
  CharacterRuleActionSystemAdapter['passiveDamageGrantPlan']
> = ({ action }) => {
  const { invocation, entries } = action.compiledEffect
  const [entry] = entries
  if (
    invocation.kind !== 'PASSIVE' ||
    invocation.triggerCode !== 'INCOMING_DAMAGE' ||
    entries.length !== 1 ||
    !entry ||
    entry.pathCode !== 'PASSIVE'
  )
    unsupported('D&D passive damage trigger must author one passive result.')
  const plan = modifierGrantEntryPlan({ action, entry, resultGated: false, untilEndEvent: false })
  if (!plan?.modifierGrantContribution)
    unsupported('D&D passive damage trigger must give a timed modifier grant.')
  return { ...plan, frozenGraph: durationPublishedGraph({ effectId: action.effectId, plan }) }
}

/** A standing effect's untimed grant: one passive result that an End On trigger ends (SPELLS-31.2). */
export const standingEffectPlan: NonNullable<
  CharacterRuleActionSystemAdapter['standingEffectPlan']
> = ({ action }) => {
  const { invocation, entries } = action.compiledEffect
  const [entry] = entries
  if (invocation.kind !== 'PASSIVE' || entries.length !== 1 || !entry)
    unsupported('D&D standing effect must author one passive result.')
  const plan = modifierGrantEntryPlan({
    action,
    entry,
    resultGated: false,
    untilEndEvent: false,
    standing: true
  })
  if (!plan?.modifierGrantContribution)
    unsupported('D&D standing effect must give an untimed modifier grant that something ends.')
  return { ...plan, frozenGraph: durationPublishedGraph({ effectId: action.effectId, plan }) }
}
