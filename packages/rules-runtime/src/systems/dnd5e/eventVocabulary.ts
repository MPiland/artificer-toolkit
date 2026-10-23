import { SPATIAL_TURN_TRIGGERS } from '@artificer-toolkit/schema/shared/spatial'
import type { CompiledManifestComponent } from '@artificer-toolkit/shared/compilers'
import type {
  EncounterEffectHook,
  EncounterEventSubscription,
  EventVocabularyCapabilityAdapter
} from '../../events/encounterEventTable.js'
import type { SystemCoreCodeEntry } from '../../systemCoreCodeCapability.js'
import { DND5E_SYSTEM_ID } from './identity.js'

/** How a lifecycle code reads in one role: its description, and whether a timed grant may carry it. */
interface LifecycleRole {
  description: string
  grantable: boolean
}

/**
 * The 5e lifecycle codes an effect lists in `consumeOnFirstEvents` or `endOnEvents`, and what each
 * means to a hook: the event applies, then the effect is gone, restored by the same receipt. This is
 * the one source of the codes: the `effectConsumeEvent` and `effectEndEvent` lists derive from it.
 * A grant cannot be used up by a cast, and an attack roll or a cast never ends one.
 */
const LIFECYCLE_EVENTS: readonly {
  code: string
  label: string
  subscription: EncounterEventSubscription
  consume?: LifecycleRole
  end?: LifecycleRole
}[] = [
  {
    code: 'ON_ATTACK_ROLL',
    label: 'On Attack Roll',
    subscription: { event: 'ACTION', fact: 'attackRoll', againstEnemyOnly: false },
    consume: { description: 'Consumed by first attack roll.', grantable: true },
    end: { description: 'Ends on attack roll.', grantable: false }
  },
  {
    code: 'ON_CAST_SPELL',
    label: 'On Cast Spell',
    subscription: { event: 'ACTION', fact: 'spellCast', againstEnemyOnly: false },
    consume: { description: 'Consumed by first spell cast.', grantable: false },
    end: { description: 'Ends on spell cast.', grantable: false }
  },
  {
    code: 'ON_TAKE_ACTION',
    label: 'On Take Action',
    subscription: { event: 'ACTION', fact: null, againstEnemyOnly: false },
    end: {
      description: 'Ends when the holder takes an action, a bonus action or a reaction.',
      grantable: true
    }
  },
  {
    code: 'ON_HIT',
    label: 'On Hit',
    subscription: { event: 'HIT' },
    consume: {
      description: 'Consumed by the first attack that hits, after it adds to that attack.',
      grantable: true
    }
  },
  {
    code: 'ON_ATTACKED',
    label: 'On Attacked',
    subscription: { event: 'ATTACKED' },
    consume: {
      description: 'Consumed by the first attack roll made against the holder.',
      grantable: true
    }
  },
  {
    code: 'ON_ABILITY_CHECK',
    label: 'On Ability Check',
    subscription: { event: 'TEST', test: 'CHECK', valueDomainCode: 'ABILITY_CHECK' },
    consume: { description: 'Consumed by first ability check.', grantable: true }
  },
  {
    code: 'ON_SAVING_THROW',
    label: 'On Saving Throw',
    subscription: { event: 'TEST', test: 'SAVE', valueDomainCode: 'SAVING_THROW_MODIFIER' },
    consume: { description: 'Consumed by first saving throw the die applied to.', grantable: true }
  },
  {
    code: 'ON_HIT_POINTS_REGAINED',
    label: 'On Hit Points Regained',
    subscription: { event: 'HIT_POINTS_REGAINED' },
    end: { description: 'Ends on healing.', grantable: true }
  },
  {
    code: 'ON_INCAPACITATED',
    label: 'On Incapacitated',
    subscription: { event: 'INCAPACITATED', of: 'HOLDER' },
    end: { description: 'Ends on incapacitation.', grantable: true }
  },
  {
    code: 'ON_IDLE_TURN',
    label: 'On Idle Turn',
    subscription: { event: 'IDLE_TURN' },
    end: {
      description:
        'Ends when the holder’s turn ends having neither attacked a hostile creature nor taken damage since their previous turn.',
      grantable: true
    }
  },
  {
    code: 'ON_LEAVING_AREA',
    label: 'On Leaving Area',
    subscription: { event: 'AREA_LEFT' },
    end: {
      description: 'Ends when the holder leaves the area of the zone that holds it.',
      grantable: false
    }
  },
  {
    code: 'ON_LONG_REST',
    label: 'On Long Rest',
    subscription: { event: 'REST', restKind: 'LONG' },
    end: { description: 'Ends when the holder finishes a long rest.', grantable: false }
  },
  {
    code: 'ON_CHOSEN_ITEM_RELEASED',
    label: 'On Chosen Item Released',
    subscription: { event: 'ITEM_RELEASED' },
    end: {
      description: 'Ends when the path’s chosen item leaves the holder’s hands or equipment.',
      grantable: true
    }
  },
  {
    code: 'ON_MOVE',
    label: 'On Move',
    subscription: { event: 'MOVED' },
    end: { description: 'Ends when the holder moves voluntarily.', grantable: true }
  }
]

function lifecycleEntries(role: 'consume' | 'end'): readonly SystemCoreCodeEntry[] {
  return LIFECYCLE_EVENTS.flatMap(({ code, label, ...roles }) =>
    roles[role] ? [{ code, label, ...roles[role] }] : []
  )
}

/** The codes a stored effect lists in `consumeOnFirstEvents`. */
export const DND5E_EFFECT_CONSUME_EVENTS = lifecycleEntries('consume')

/** The codes a stored effect lists in `endOnEvents`. */
export const DND5E_EFFECT_END_EVENTS = lifecycleEntries('end')

/**
 * The traits of an action that an end trigger may name (Sanctuary). `actionFact` is the fact the
 * Encounter raises with an action that the trait describes.
 */
export const DND5E_ACTION_TRAITS = [
  { code: 'ATTACK_ROLL', label: 'Attack roll', actionFact: 'attackRoll' },
  { code: 'SPELL_CAST', label: 'Spell cast', actionFact: 'spellCast' }
] as const satisfies readonly SystemCoreCodeEntry[]

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
  const row = LIFECYCLE_EVENTS.find((candidate) => candidate.code === code)
  if (!row) throw new Error(`The 5e event vocabulary has no lifecycle event "${code}".`)
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
    const ends: EncounterEventSubscription[] = [
      ...recurrence.consumeOnFirstEvents,
      ...recurrence.endOnEvents
    ].map(lifecycleSubscription)
    for (const trigger of recurrence.endOnTriggers)
      switch (trigger.event) {
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
