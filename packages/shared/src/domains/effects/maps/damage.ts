import {
  type DamageAuthored,
  type DamageBonusAuthored,
  type DamageDicePayload,
  type DamageFixedPayload
} from '#authored'
import { DAMAGE_BONUS_OPTIONS, DAMAGE_VALUE_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'
import { type AllUnionFields } from 'type-fest'

// Helper type to extract element type from array property
type ArrayElementAt<T, K extends keyof T> = NonNullable<T[K]> extends (infer U)[] ? U : never

type DamageArrayElement = ArrayElementAt<
  AllUnionFields<DamageDicePayload | DamageFixedPayload>,
  'levels'
>

type DamageUnioned = AllUnionFields<DamageAuthored>

const damageBonus = buildNodeMap<DamageBonusAuthored>()

export const DAMAGE_BONUS_NODE_MAP = damageBonus.define(
  'damageBonus',
  ({ map, nodes, cond, data }) => {
    const { selectSingle, number, text } = nodes
    const { table } = data
    const local = cond.local()

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'bonusKind',
        selectSingle(
          ['bonusKind'],
          'Bonus Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: DAMAGE_BONUS_OPTIONS
          },
          {
            order: 1,
            requiredIf: true
          }
        )
      )
      .set(
        'ability',
        selectSingle(
          ['ability'],
          'Ability',
          {
            kind: 'DATA',
            relationship: data.table('ability_modifier_references', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            order: 2,
            requiredIf: true,
            showIf: local.field(['bonusKind']).eq('ABILITY_BONUS')
          }
        )
      )
      .set(
        'skillId',
        selectSingle(
          ['skillId'],
          'Skill',
          {
            kind: 'DATA',
            relationship: table('skills', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            order: 2,
            requiredIf: true,
            showIf: local.field(['bonusKind']).eq('SKILL_BONUS')
          }
        )
      )
      .set(
        'min',
        number(['min'], 'Min Amount', {
          order: 3,
          constraints: { minimum: 0 }
        })
      )
      .set(
        'max',
        number(['max'], 'Max Amount', {
          order: 3,
          constraints: { minimum: 0 }
        })
      )
      .set(
        'multiplier',
        number(['multiplier'], 'Multiplier', {
          order: 4,
          constraints: { minimum: 0 }
        })
      )
      .set(
        'order',
        number(['order'], 'Order', {
          order: 5,
          requiredIf: true
        })
      )
  }
)

// Main Damage Node Map - handles all damage value kinds
const damage = buildNodeMap<DamageUnioned>()

export const DAMAGE_NODE_MAP = damage.define('damage', ({ map, nodes, cond, data, logic }) => {
  const { text, number, selectSingle, groupArray, toggle } = nodes
  const { table } = data
  const { and, not } = logic
  const local = cond.local()

  map
    .set('id', text(['id'], 'ID'))
    .set('effectKind', text(['effectKind'], 'Effect Kind'))
    .set(
      'usesTriggeringWeaponDamageType',
      toggle(['usesTriggeringWeaponDamageType'], "Use the triggering weapon's damage type", {
        order: 1
      })
    )
    .set(
      'damageTypeId',
      selectSingle(
        ['damageTypeId'],
        'Damage Type',
        {
          kind: 'DATA',
          relationship: table('damage_types', {
            selectColumns: ['id', 'label', 'description']
          })
        },
        {
          order: 1,
          requiredIf: not(local.field(['usesTriggeringWeaponDamageType']).eq(true)),
          showIf: not(local.field(['usesTriggeringWeaponDamageType']).eq(true))
        }
      )
    )
    .set(
      'valueKind',
      selectSingle(
        ['valueKind'],
        'Damage Value Kind',
        {
          kind: 'INLINE_OPTIONS',
          options: DAMAGE_VALUE_OPTIONS
        },
        {
          order: 2,
          requiredIf: true
        }
      )
    )
    .set(
      'fixedAmount',
      number(['amount'], 'Amount', {
        order: 3,
        constraints: { minimum: 0 },
        requiredIf: true,
        showIf: local.field(['valueKind']).eq('FIXED')
      })
    )
    .set(
      'diceConfig',
      text(['diceConfig'], 'Dice Config', {
        order: 3,
        requiredIf: true,
        showIf: local.field(['valueKind']).eq('DICE')
      })
    )
    .set(
      'halfHitPointsDiceConfig',
      text(['halfHitPointsDiceConfig'], 'Dice at Half Hit Points or Fewer', {
        order: 3,
        showIf: and([
          local.field(['valueKind']).eq('DICE'),
          local.field(['scalingKind']).eq('NONE')
        ])
      })
    )
    .set(
      'poolAmount',
      number(['amount'], 'Pool Amount', {
        order: 3,
        constraints: { minimum: 0 },
        requiredIf: true,
        showIf: local.field(['valueKind']).eq('POOL')
      })
    )
    .set(
      'scalingKind',
      selectSingle(
        ['scalingKind'],
        'Scaling Kind',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'NONE', label: 'None' },
            { code: 'PER_LEVEL', label: 'Per Level' }
          ]
        },
        {
          order: 4,
          requiredIf: true
        }
      )
    )
    .set(
      'multiplier',
      number(['multiplier'], 'Damage Multiplier', {
        order: 5,
        constraints: { minimum: 0 }
      })
    )
    .set(
      'bonuses',
      groupArray(['bonuses'], 'Damage Bonuses', () => DAMAGE_BONUS_NODE_MAP, {
        presentation: 'inline',
        order: 6
      })
    )
})

const damageLevelScalingEntry = buildNodeMap<DamageArrayElement>()

export const DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP = damageLevelScalingEntry.define(
  'damageLevelScalingEntry',
  ({ map, nodes, cond }) => {
    const { number, text } = nodes
    const parent = cond.parent<DamageUnioned>()

    map
      .set(
        'level',
        number(['level'], 'Level', {
          order: 1,
          requiredIf: true
        })
      )
      .set(
        'diceConfig',
        text(['diceConfig'], 'Damage Dice', {
          order: 2,
          requiredIf: true,
          showIf: parent.field(['valueKind']).eq('DICE')
        })
      )
      .set(
        'amount',
        number(['amount'], 'Damage Amount', {
          order: 2,
          constraints: { minimum: 0 },
          requiredIf: true,
          showIf: parent.field(['valueKind']).eq('FIXED')
        })
      )
  }
)
