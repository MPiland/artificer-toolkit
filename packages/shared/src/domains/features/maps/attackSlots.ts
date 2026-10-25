import type { AttackSlot, AttackSlotCondition, AttackSlotFiller, AttackSlotSet } from '#authored'
import { AUTHORING_ACTION_PRESENTATIONS, buildNodeMap } from '#utils'

const filler = buildNodeMap<AttackSlotFiller>()

/** What fills a slot: one of the Creature's own action Features, or any Attack-action attack (D93). */
const ATTACK_SLOT_FILLER_NODE_MAP = filler.define('attackSlotFiller', ({ map, nodes, cond }) => {
  const { selectSingle } = nodes
  map
    .set(
      'kind',
      selectSingle(
        ['kind'],
        'Filled by',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'FEATURE', label: 'One of this Creature’s actions' },
            { code: 'ANY_ATTACK', label: 'Any attack of the Attack action' }
          ]
        },
        { order: 1, requiredIf: true }
      )
    )
    .set(
      'featureId',
      selectSingle(
        ['featureId'],
        'Action',
        {
          kind: 'LOCAL_COLLECTION',
          rootCollectionPath: ['features'],
          valuePath: ['id'],
          labelPath: ['label']
        },
        {
          order: 2,
          requiredIf: true,
          showIf: cond.local().field(['kind']).eq('FEATURE'),
          hiddenBehavior: 'CLEAR'
        }
      )
    )
})

const condition = buildNodeMap<AttackSlotCondition>()

/** A predicate a slot holds only while true (D93). */
export const ATTACK_SLOT_CONDITION_NODE_MAP = condition.define(
  'attackSlotCondition',
  ({ map, nodes, cond, data }) => {
    const { selectSingle } = nodes
    map
      .set(
        'kind',
        selectSingle(
          ['kind'],
          'Only when',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              {
                code: 'EARLIER_SLOTS_HIT_SAME_TARGET',
                label: 'Earlier attacks of this action hit the same target'
              },
              { code: 'TARGET_SIZE_AT_MOST', label: 'The target is no larger than' }
            ]
          },
          { order: 1, requiredIf: true }
        )
      )
      .set(
        'size',
        selectSingle(
          ['size'],
          'Size',
          {
            kind: 'DATA',
            relationship: data.table('sizes', { selectColumns: ['id', 'label', 'description'] })
          },
          {
            order: 2,
            requiredIf: true,
            showIf: cond.local().field(['kind']).eq('TARGET_SIZE_AT_MOST'),
            hiddenBehavior: 'CLEAR'
          }
        )
      )
  }
)

const slot = buildNodeMap<AttackSlot>()

/** One slot: how many attacks it takes, what may fill it, and when it applies. */
const ATTACK_SLOT_NODE_MAP = slot.define('attackSlot', ({ map, nodes }) => {
  const { number, toggle, groupArray, groupObject } = nodes
  map
    .set(
      'count',
      number(['count'], 'Attacks', { order: 1, constraints: { minimum: 1, maximum: 10 } })
    )
    .set(
      'fillers',
      groupArray(['fillers'], 'Filled by', () => ATTACK_SLOT_FILLER_NODE_MAP, {
        presentation: 'inline',
        order: 2
      })
    )
    .set('optional', toggle(['optional'], 'May stay empty', { order: 3 }))
    .set('comesFirst', toggle(['comesFirst'], 'Comes first', { order: 4 }))
    .set(
      'condition',
      groupObject(['condition'], 'Condition', () => ATTACK_SLOT_CONDITION_NODE_MAP, {
        presentation: 'inline',
        order: 5,
        authoring: {
          actions: [
            {
              type: 'collection.add',
              label: 'Add',
              presentation: AUTHORING_ACTION_PRESENTATIONS.button
            }
          ]
        }
      })
    )
})

const alternative = buildNodeMap<AttackSlotSet['alternatives'][number]>()

/** One way the action may be spent; a swap ("replace one attack with a bite") is another alternative. */
const ATTACK_SLOT_ALTERNATIVE_NODE_MAP = alternative.define(
  'attackSlotAlternative',
  ({ map, nodes }) => {
    map.set(
      'slots',
      nodes.groupArray(['slots'], 'Slots', () => ATTACK_SLOT_NODE_MAP, {
        presentation: 'branch',
        order: 1
      })
    )
  }
)

const slotSet = buildNodeMap<AttackSlotSet>()

/** The attack slots a Creature's Multiattack-style action opens (D93). */
export const ATTACK_SLOT_SET_NODE_MAP = slotSet.define('attackSlotSet', ({ map, nodes }) => {
  map.set(
    'alternatives',
    nodes.groupArray(['alternatives'], 'Alternatives', () => ATTACK_SLOT_ALTERNATIVE_NODE_MAP, {
      presentation: 'branch',
      order: 1
    })
  )
})
