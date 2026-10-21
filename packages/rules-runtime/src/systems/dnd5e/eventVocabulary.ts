import type {
  ActiveEffectConsumeEvent,
  ActiveEffectEndEvent
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type {
  EncounterEffectHook,
  EncounterEventSubscription,
  EventVocabularyCapabilityAdapter
} from '../../events/encounterEventTable.js'
import { DND5E_SYSTEM_ID } from './identity.js'

/**
 * The 5e lifecycle codes an effect lists in `consumeOnFirstEvents` or `endOnEvents`. Both lists mean
 * the same to a hook: the event applies, then the effect is gone, restored by the same receipt.
 */
const LIFECYCLE_EVENT_SUBSCRIPTIONS = {
  ON_ATTACK_ROLL: { event: 'ACTION', requires: 'ATTACK_ROLL', againstEnemyOnly: false },
  ON_CAST_SPELL: { event: 'ACTION', requires: 'SPELL_CAST', againstEnemyOnly: false },
  ON_TAKE_ACTION: { event: 'ACTION', requires: 'ANY', againstEnemyOnly: false },
  ON_HIT: { event: 'HIT' },
  ON_ATTACKED: { event: 'ATTACKED' },
  ON_ABILITY_CHECK: { event: 'TEST', test: 'CHECK', valueDomainCode: 'ABILITY_CHECK' },
  ON_SAVING_THROW: { event: 'TEST', test: 'SAVE', valueDomainCode: 'SAVING_THROW_MODIFIER' },
  ON_HIT_POINTS_REGAINED: { event: 'HIT_POINTS_REGAINED' },
  ON_INCAPACITATED: { event: 'INCAPACITATED', of: 'HOLDER' },
  ON_IDLE_TURN: { event: 'IDLE_TURN' },
  ON_LEAVING_AREA: { event: 'AREA_LEFT' },
  ON_LONG_REST: { event: 'REST', restKind: 'LONG' },
  ON_CHOSEN_ITEM_RELEASED: { event: 'ITEM_RELEASED' },
  ON_MOVE: { event: 'MOVED' }
} as const satisfies Record<
  ActiveEffectConsumeEvent | ActiveEffectEndEvent,
  EncounterEventSubscription
>

function lifecycleSubscription(code: string): EncounterEventSubscription {
  if (!Object.hasOwn(LIFECYCLE_EVENT_SUBSCRIPTIONS, code))
    throw new Error(`The 5e event vocabulary has no lifecycle event "${code}".`)
  return LIFECYCLE_EVENT_SUBSCRIPTIONS[code as keyof typeof LIFECYCLE_EVENT_SUBSCRIPTIONS]
}

export const dnd5eEventVocabularyCapabilityAdapter: EventVocabularyCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  effectHooks(recurrence) {
    const ends: EncounterEventSubscription[] = [
      ...recurrence.consumeOnFirstEvents,
      ...recurrence.endOnEvents
    ].map(lifecycleSubscription)
    for (const trigger of recurrence.endOnTriggers)
      switch (trigger.event) {
        case 'DAMAGE_TAKEN':
          ends.push({ event: 'DAMAGED', by: trigger.by, damageTypeIds: trigger.damageTypeIds })
          break
        case 'ATTACK_ROLL':
        case 'SPELL_CAST':
          ends.push({
            event: 'ACTION',
            requires: trigger.event,
            againstEnemyOnly: trigger.against === 'ENEMY'
          })
          break
        case 'ACTION_USED_ON_HOLDER':
          ends.push({
            event: 'ACTION_USED_ON_HOLDER',
            actionDefinitionIds: trigger.actionDefinitionIds
          })
          break
        case 'INCAPACITATED':
          ends.push({ event: 'INCAPACITATED', of: trigger.of })
          break
      }
    if (recurrence.endOnConditionIds.length > 0)
      ends.push({ event: 'CONDITION_HELD', conditionIds: recurrence.endOnConditionIds })
    return [
      ...ends.map((subscription): EncounterEffectHook => ({ hook: 'END', subscription })),
      ...(recurrence.repeatTriggers ?? []).map((trigger): EncounterEffectHook => ({
        hook: 'REPEAT_SAVE',
        subscription: { event: 'DAMAGED', by: trigger.by, damageTypeIds: trigger.damageTypeIds },
        trigger
      }))
    ]
  }
}
