import { SPATIAL_TURN_TRIGGERS } from '@artificer-toolkit/schema/shared/spatial'
import type { CompiledManifestComponent } from '@artificer-toolkit/shared/compilers'
import type {
  EncounterEffectHook,
  EncounterEventSubscription,
  EventVocabularyCapabilityAdapter
} from '../../events/encounterEventTable.js'
import { DND5E_ACTION_TRAITS, LIFECYCLE_EVENTS } from './lifecycleVocabulary.js'
import { DND5E_SYSTEM_ID } from './identity.js'

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

function lifecycleSubscription(
  timing: 'CONSUME' | 'END',
  code: string
): EncounterEventSubscription {
  const row = LIFECYCLE_EVENTS.find((candidate) => candidate.code === code)
  if (!row?.[timing === 'CONSUME' ? 'consume' : 'end'])
    throw new Error(`The 5e event vocabulary has no ${timing} lifecycle event "${code}".`)
  return row.subscription
}

function actionTraitFact(trait: string) {
  const entry = DND5E_ACTION_TRAITS.find((candidate) => candidate.code === trait)
  if (!entry) throw new Error(`The 5e event vocabulary has no action trait "${trait}".`)
  return entry.actionFact
}

export const dnd5eEventVocabularyCapabilityAdapter: EventVocabularyCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  effectHooks(recurrence) {
    const ends: EncounterEventSubscription[] = []
    for (const trigger of recurrence.endTriggers)
      switch (trigger.event) {
        case 'LIFECYCLE':
          ends.push(lifecycleSubscription(trigger.timing, trigger.code))
          break
        case 'DAMAGE_TAKEN':
          ends.push({ event: 'DAMAGED', by: trigger.by, damageTypeIds: trigger.damageTypeIds })
          break
        case 'ACTION_TRAIT':
          ends.push({
            event: 'ACTION',
            fact: actionTraitFact(trigger.trait),
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
        case 'SEPARATED':
          ends.push({ event: 'SEPARATED', from: trigger.from, beyondFeet: trigger.beyondFeet })
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
