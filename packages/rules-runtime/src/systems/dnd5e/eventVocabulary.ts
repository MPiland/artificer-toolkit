import type {
  ActiveEffectConsumeEvent,
  ActiveEffectEndEvent
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { SPATIAL_TURN_TRIGGERS } from '@artificer-toolkit/schema/shared/spatial'
import type { CompiledManifestComponent } from '@artificer-toolkit/shared/compilers'
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

type ZoneSubscription = NonNullable<
  ReturnType<EventVocabularyCapabilityAdapter['zoneSubscription']>
>
type ZoneInteractionKind = NonNullable<CompiledManifestComponent['interactionKinds']>[number]

/** The movements each 5e zone interaction acts on. */
const ZONE_MOVEMENT_SUBSCRIPTIONS: Readonly<
  Partial<Record<ZoneInteractionKind, ZoneSubscription['triggerModes']>>
> = {
  ENTER_SPACE: ['ENTER'],
  ENTER_OR_PASS_THROUGH: ['ENTER', 'CROSS'],
  MOVE_ACROSS: ['CROSS'],
  LEAVE_SPACE: ['EXIT']
}

/** The turn boundary each 5e zone interaction acts at, for a creature inside. */
const ZONE_TURN_SUBSCRIPTIONS: Readonly<
  Partial<Record<ZoneInteractionKind, NonNullable<ZoneSubscription['turnTriggers']>[number]>>
> = {
  START_TURN_IN_SPACE: 'START_OF_TURN',
  END_TURN_IN_SPACE: 'END_OF_TURN',
  START_OF_SOURCE_TURN: 'START_OF_SOURCE_TURN'
}

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
  },
  zoneSubscription(kinds) {
    if (!kinds?.length) return null
    const movement = new Set<string>()
    const turn = new Set<string>()
    for (const kind of kinds) {
      if (kind === 'MELEE_HIT_ON_SOURCE') continue
      const movements = ZONE_MOVEMENT_SUBSCRIPTIONS[kind]
      const boundary = ZONE_TURN_SUBSCRIPTIONS[kind]
      if (!movements && !boundary) return null
      movements?.forEach((trigger) => movement.add(trigger))
      if (boundary) turn.add(boundary)
    }
    const turnTriggers = SPATIAL_TURN_TRIGGERS.filter((trigger) => turn.has(trigger))
    return {
      triggerModes: (['ENTER', 'EXIT', 'CROSS'] as const).filter((trigger) =>
        movement.has(trigger)
      ),
      ...(turnTriggers.length ? { turnTriggers } : {}),
      ...(kinds.includes('MELEE_HIT_ON_SOURCE') ? { retaliatesMeleeHits: true as const } : {})
    }
  }
}
