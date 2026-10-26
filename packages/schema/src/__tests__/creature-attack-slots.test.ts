import { describe, expect, it } from 'vitest'

import { CREATURE_FEATURE_NODE_MAP } from '@artificer-toolkit/shared/maps'
import {
  MAX_ATTACK_SLOT_ALTERNATIVES,
  MAX_ATTACK_SLOT_COUNT,
  MAX_ATTACK_SLOTS_PER_ALTERNATIVE
} from '../features/attackSlots.js'
import { creaturePublicationDtoSchema } from '../subjects/creature.js'

const uuid = (suffix: number) => `00000000-0000-4000-8000-${suffix.toString(16).padStart(12, '0')}`

const biteId = uuid(10)
const clawsId = uuid(20)
const multiattackId = uuid(30)
const keenSmellId = uuid(40)

/** A melee attack action with its one ATTACK roll, as an owner publishes it. */
function attackAction(id: string, label: string, base: number) {
  return {
    id,
    label,
    description: `${label}. Melee Weapon Attack: +4 to hit.`,
    order: 1,
    rollDefinitions: [
      {
        id: uuid(base + 1),
        label: `${label} attack`,
        kind: 'ATTACK',
        expression: { count: 1, die: 20, modifier: 4 },
        rollMode: 'NORMAL',
        chargeCost: null,
        order: 1
      }
    ],
    effects: [
      {
        id: uuid(base + 2),
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: 'MELEE_WEAPON_ATTACK',
          activation: { code: 'ACTION', amount: 1 },
          range: { id: uuid(base + 3), rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: [
          {
            id: uuid(base + 4),
            order: 1,
            pathCode: 'ON_HIT',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: uuid(base + 5),
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: uuid(base + 6),
                  effectKind: 'DAMAGE',
                  damageTypeId: uuid(base + 7),
                  valueKind: 'DICE',
                  scalingKind: 'NONE',
                  diceConfig: '1d8'
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

const passiveFeature = {
  id: keenSmellId,
  label: 'Keen Smell',
  description: 'Advantage on Wisdom (Perception) checks that rely on smell.',
  order: 3
}

const slot = (featureId: string) => ({ count: 1, fillers: [{ kind: 'FEATURE', featureId }] })

/** A Brown Bear-style Multiattack: one bite and one claws. */
const brownBearSet = { alternatives: [{ slots: [slot(biteId), slot(clawsId)] }] }

function creature(attackSlots: unknown) {
  return {
    id: uuid(1),
    label: 'Homebrew Bear',
    userId: uuid(2),
    systemId: uuid(3),
    category: 'BEAST',
    creatureTypeId: uuid(4),
    size: 'LARGE',
    abilityScores: {
      STRENGTH: 19,
      DEXTERITY: 10,
      CONSTITUTION: 16,
      INTELLIGENCE: 2,
      WISDOM: 13,
      CHARISMA: 7
    },
    naturalArmorBonus: 1,
    hitPoints: 34,
    speeds: [],
    details: [],
    proficiencies: [],
    senses: [],
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    qualifiedDamageDefenses: [],
    conditionImmunities: [],
    features: [
      attackAction(biteId, 'Bite', 100),
      attackAction(clawsId, 'Claws', 200),
      passiveFeature,
      {
        id: multiattackId,
        label: 'Multiattack',
        description: 'The bear makes two attacks: one with its bite and one with its claws.',
        order: 2,
        attackSlots
      }
    ]
  }
}

const publish = (attackSlots: unknown) =>
  creaturePublicationDtoSchema.safeParse(creature(attackSlots))

describe('Creature attack slot set publication (ATTACK-11.3)', () => {
  it('publishes a Brown Bear-style set of one bite and one claws', () => {
    expect(publish(brownBearSet).error?.issues).toBeUndefined()
  })

  it('publishes alternatives, a swap, optional and comes-first slots, and both conditions', () => {
    const parsed = publish({
      alternatives: [
        {
          slots: [
            { ...slot(clawsId), comesFirst: true },
            { count: 2, fillers: [{ kind: 'ANY_ATTACK' }], optional: true },
            { ...slot(biteId), condition: { kind: 'EARLIER_SLOTS_HIT_SAME_TARGET' } }
          ]
        },
        {
          slots: [{ ...slot(biteId), condition: { kind: 'TARGET_SIZE_AT_MOST', size: 'MEDIUM' } }]
        }
      ]
    })
    expect(parsed.error?.issues).toBeUndefined()
  })

  it.each([
    ['an unknown action', slot(uuid(999))],
    ['a passive Feature', slot(keenSmellId)],
    ['the Multiattack itself', slot(multiattackId)]
  ])('refuses a slot filled by %s', (_, refused) => {
    const parsed = publish({ alternatives: [{ slots: [slot(biteId), refused] }] })
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({
        path: [
          'features',
          3,
          'attackSlots',
          'alternatives',
          0,
          'slots',
          1,
          'fillers',
          0,
          'featureId'
        ],
        message: '"Multiattack" must fill a slot with another action Feature of this Creature.'
      })
    ])
  })

  it.each([
    ['no alternatives', { alternatives: [] }],
    ['an alternative with no slots', { alternatives: [{ slots: [] }] }],
    ['a slot with no fillers', { alternatives: [{ slots: [{ count: 1, fillers: [] }] }] }],
    ['a slot of zero attacks', { alternatives: [{ slots: [{ ...slot(biteId), count: 0 }] }] }],
    [
      'a slot over the attack limit',
      { alternatives: [{ slots: [{ ...slot(biteId), count: MAX_ATTACK_SLOT_COUNT + 1 }] }] }
    ],
    [
      'too many alternatives',
      {
        alternatives: Array.from({ length: MAX_ATTACK_SLOT_ALTERNATIVES + 1 }, () => ({
          slots: [slot(biteId)]
        }))
      }
    ],
    [
      'too many slots in an alternative',
      {
        alternatives: [
          {
            slots: Array.from({ length: MAX_ATTACK_SLOTS_PER_ALTERNATIVE + 1 }, () => slot(biteId))
          }
        ]
      }
    ],
    [
      'a size condition with a malformed size',
      {
        alternatives: [
          {
            slots: [
              { ...slot(biteId), condition: { kind: 'TARGET_SIZE_AT_MOST', size: 'enormous' } }
            ]
          }
        ]
      }
    ],
    [
      'a size condition with no size',
      {
        alternatives: [{ slots: [{ ...slot(biteId), condition: { kind: 'TARGET_SIZE_AT_MOST' } }] }]
      }
    ],
    [
      'an unknown condition',
      { alternatives: [{ slots: [{ ...slot(biteId), condition: { kind: 'ALWAYS' } }] }] }
    ]
  ])('refuses %s', (_, attackSlots) => {
    expect(publish(attackSlots).success).toBe(false)
  })
})

describe('Creature attack slot editor node map', () => {
  type NodeMap = { nodes: Record<string, Node> }
  type Node = {
    nodes?: NodeMap | (() => NodeMap)
    constraints?: { minimum?: number; maximum?: number }
  }
  const open = (node: Node | undefined): NodeMap => {
    if (!node?.nodes) throw new Error('Expected a group node.')
    return typeof node.nodes === 'function' ? node.nodes() : node.nodes
  }

  it('bounds a slot count by the contract limit the validator enforces', () => {
    const set = open(CREATURE_FEATURE_NODE_MAP.nodes.attackSlots as Node)
    const slotMap = open(open(set.nodes.alternatives).nodes.slots)
    expect(slotMap.nodes.count?.constraints).toEqual({ minimum: 1, maximum: MAX_ATTACK_SLOT_COUNT })
  })
})
