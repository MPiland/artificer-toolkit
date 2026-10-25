import { ChargeBonusAuthored, type ChargeAuthored, type ChargeLimitPayload } from '#authored'
import {
  CHARGE_BONUS_OPTIONS,
  CHARGE_LIMIT_OPTIONS,
  CHARGE_RESET_OPTIONS,
  SCALING_OPTIONS,
  CHARGE_LIMIT_KIND,
  SOURCE_CHARGE_LIMIT_OPTION
} from '#core'
import { buildNodeMap } from '#utils'
import { AllUnionFields } from 'type-fest'

const chargeBonus = buildNodeMap<ChargeBonusAuthored>()

const CHARGE_BONUS_NODE_MAP = chargeBonus.define('chargeBonus', ({ map, nodes, cond, data }) => {
  const { selectSingle, number } = nodes
  const { table } = data
  const local = cond.local()

  map
    .set(
      'bonusKind',
      selectSingle(
        ['bonusKind'],
        'Bonus Kind',
        {
          kind: 'INLINE_OPTIONS',
          options: CHARGE_BONUS_OPTIONS
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
          relationship: data.table('abilities', { selectColumns: ['id', 'label', 'description'] })
        },
        {
          order: 2,
          requiredIf: true,
          showIf: local.field(['bonusKind']).eq('ABILITY_MODIFIER')
        }
      )
    )
    .set(
      'skill',
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
      number(['min'], 'Min. Amount', {
        constraints: { minimum: 0 },
        order: 3
      })
    )
    .set(
      'max',
      number(['max'], 'Max. Amount', {
        constraints: { minimum: 0 },
        order: 3
      })
    )
    .set(
      'multiplier',
      number(['multiplier'], 'Multiplier', {
        constraints: { minimum: 0 },
        order: 3
      })
    )
})

const chargeLevelScaling =
  buildNodeMap<NonNullable<AllUnionFields<ChargeLimitPayload>['levels']>[number]>()

const CHARGE_LEVEL_SCALING_NODE_MAP = chargeLevelScaling.define('levels', ({ map, nodes }) => {
  const { number } = nodes

  map
    .set(
      'level',
      number(['level'], 'Level', {
        order: 1,
        requiredIf: true
      })
    )
    .set(
      'amount',
      number(['amount'], 'Amount', {
        order: 2,
        requiredIf: true
      })
    )
})

type ChargeOwner = {
  attributes?: string[]
}

const charges = buildNodeMap<ChargeAuthored<true>>()

export const CHARGE_NODE_MAP = charges.define('charges', ({ map, nodes, logic, cond, data }) => {
  const { selectSingle, groupArray, number } = nodes
  const { or, and, not } = logic
  const local = cond.local()
  const isSourceCharges = local.field(['limitKind']).eq(CHARGE_LIMIT_KIND.SOURCE_CHARGES)
  const always = not(and([isSourceCharges, not(isSourceCharges)]))
  const hasChargeSource = or(
    [2, 3, 4, 5, 6].map((up) => {
      const ancestor = cond.ancestor<ChargeOwner>(up)
      return ancestor.field(['attributes']).contains(['LIMITED_USE'])
    })
  )

  map
    .set(
      'resetKind',
      selectSingle(
        ['resetKind'],
        'Reset Kind',
        {
          kind: 'INLINE_OPTIONS',
          options: CHARGE_RESET_OPTIONS
        },
        {
          order: 1,
          requiredIf: true,
          showIf: not(isSourceCharges),
          hiddenBehavior: 'CLEAR'
        }
      )
    )
    .set(
      'limitKind',
      selectSingle(
        ['limitKind'],
        'Limit Kind',
        {
          kind: 'INLINE_GROUPS',
          optionGroups: [
            {
              showIf: always,
              options: CHARGE_LIMIT_OPTIONS
            },
            {
              showIf: hasChargeSource,
              options: [SOURCE_CHARGE_LIMIT_OPTION]
            }
          ]
        },
        {
          order: 1,
          requiredIf: true
        }
      )
    )
    .set(
      'bonuses',
      groupArray(['bonuses'], 'Bonuses', () => CHARGE_BONUS_NODE_MAP, {
        presentation: 'inline',
        order: 2,
        showIf: not(isSourceCharges),
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'cost',
      number(['cost'], 'Charge Cost', {
        order: 2,
        requiredIf: true,
        showIf: isSourceCharges
      })
    )
    .set(
      'ability',
      selectSingle(
        ['ability'],
        'Ability',
        {
          kind: 'DATA',
          relationship: data.table('abilities', { selectColumns: ['id', 'label', 'description'] })
        },
        {
          order: 3,
          requiredIf: true,
          showIf: local.field(['limitKind']).eq(CHARGE_LIMIT_KIND.ABILITY_MODIFIER),
          hiddenBehavior: 'CLEAR'
        }
      )
    )
    .set(
      'multiplier',
      number(['multiplier'], 'Multiplier', {
        order: 4,
        showIf: or([
          local.field(['limitKind']).eq('CHARACTER_LEVEL'),
          local.field(['limitKind']).eq('CLASS_LEVEL'),
          local.field(['limitKind']).eq('PARENT_CLASS_LEVEL'),
          local.field(['limitKind']).eq('SPELL_CAST_LEVEL'),
          local.field(['limitKind']).eq('ABILITY_MODIFIER')
        ]),
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'classId',
      selectSingle(
        ['classId'],
        'Class',
        {
          kind: 'DATA',
          relationship: {
            kind: 'TABLE',
            table: 'classes',
            selectColumns: ['id', 'label']
          }
        },
        {
          order: 4,
          requiredIf: true,
          showIf: local.field(['limitKind']).eq('CLASS_LEVEL'),
          hiddenBehavior: 'CLEAR'
        }
      )
    )
    .set(
      'scalingKind',
      selectSingle(
        ['scalingKind'],
        'Scaling',
        {
          kind: 'INLINE_OPTIONS',
          options: SCALING_OPTIONS
        },
        {
          order: 3,
          requiredIf: true,
          showIf: local.field(['limitKind']).eq('FIXED_AMOUNT')
        }
      )
    )
    .set(
      'amount',
      number(['amount'], 'Amount', {
        order: 4,
        requiredIf: true,
        showIf: and([
          local.field(['limitKind']).eq('FIXED_AMOUNT'),
          local.field(['scalingKind']).eq('NONE')
        ]),
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'min',
      number(['min'], 'Min. Amount', {
        order: 5,
        showIf: and([
          not(local.field(['limitKind']).eq(CHARGE_LIMIT_KIND.FIXED_AMOUNT)),
          not(isSourceCharges)
        ]),
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'max',
      number(['max'], 'Max. Amount', {
        order: 6,
        showIf: and([
          not(local.field(['limitKind']).eq(CHARGE_LIMIT_KIND.FIXED_AMOUNT)),
          not(isSourceCharges)
        ]),
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'levels',
      groupArray(['levels'], 'Levels', () => CHARGE_LEVEL_SCALING_NODE_MAP, {
        presentation: 'table',
        order: 4,
        showIf: and([
          local.field(['limitKind']).eq(CHARGE_LIMIT_KIND.FIXED_AMOUNT),
          local.field(['scalingKind']).eq('PER_LEVEL')
        ]),
        hiddenBehavior: 'CLEAR'
      })
    )
})
