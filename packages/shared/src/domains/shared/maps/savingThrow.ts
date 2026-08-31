import type { SavingThrowAuthored, SavingThrowDcBonusAuthored } from '#authored'
import {
  SAVING_THROW_DC_BONUS_KIND,
  SAVING_THROW_DC_BONUS_OPTIONS,
  SAVING_THROW_DC_METHOD,
  SAVING_THROW_DC_METHOD_OPTIONS
} from '#core'
import { buildNodeMap } from '#utils'

const savingThrowDcBonus = buildNodeMap<SavingThrowDcBonusAuthored>()
const savingThrow = buildNodeMap<SavingThrowAuthored>()

const SAVING_THROW_DC_BONUS_NODE_MAP = savingThrowDcBonus.define(
  'savingThrowDcBonus',
  ({ map, cond, nodes, data }) => {
    const { selectSingle, number } = nodes
    const local = cond.local()
    const { table } = data

    map
      .set(
        'bonusKind',
        selectSingle(
          ['bonusKind'],
          'Bonus Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: SAVING_THROW_DC_BONUS_OPTIONS
          },
          {
            order: 1,
            requiredIf: true
          }
        )
      )
      .set(
        'abilityDefinitionId',
        selectSingle(
          ['abilityDefinitionId'],
          'DC Ability',
          {
            kind: 'DATA',
            relationship: table('ability_definitions', { selectColumns: ['id', 'label'] })
          },
          {
            order: 2,
            requiredIf: true,
            showIf: local.field(['bonusKind']).eq(SAVING_THROW_DC_BONUS_KIND.ABILITY_MODIFIER)
          }
        )
      )
      .set(
        'amount',
        number(['amount'], 'Amount', {
          constraints: { minimum: 0 },
          order: 2,
          requiredIf: true,
          showIf: local.field(['bonusKind']).eq(SAVING_THROW_DC_BONUS_KIND.STATIC_BONUS)
        })
      )
  }
)

export const SAVING_THROW_NODE_MAP = savingThrow.define(
  'savingThrow',
  ({ map, cond, nodes, logic, data }) => {
    const { selectSingle, number, groupArray } = nodes
    const { or } = logic
    const local = cond.local()
    const { table } = data

    map
      .set(
        'dcMethod',
        selectSingle(
          ['dcMethod'],
          'DC Method',
          {
            kind: 'INLINE_OPTIONS',
            options: SAVING_THROW_DC_METHOD_OPTIONS
          },
          {
            order: 1,
            requiredIf: true
          }
        )
      )
      .set(
        'abilityDefinitionId',
        selectSingle(
          ['abilityDefinitionId'],
          'Save Ability',
          {
            kind: 'DATA',
            relationship: table('ability_definitions', { selectColumns: ['id', 'label'] })
          },
          {
            order: 2,
            requiredIf: true,
            showIf: or([
              local.field(['dcMethod']).eq(SAVING_THROW_DC_METHOD.FIXED_DC),
              local.field(['dcMethod']).eq(SAVING_THROW_DC_METHOD.SOURCE_SAVE_DC),
              local.field(['dcMethod']).eq(SAVING_THROW_DC_METHOD.DERIVED_DC)
            ])
          }
        )
      )
      .set(
        'baseDc',
        number(['baseDc'], 'Base DC', {
          order: 3,
          requiredIf: true,
          showIf: or([
            local.field(['dcMethod']).eq(SAVING_THROW_DC_METHOD.FIXED_DC),
            local.field(['dcMethod']).eq(SAVING_THROW_DC_METHOD.DERIVED_DC)
          ])
        })
      )
      .set(
        'bonuses',
        groupArray(['bonuses'], 'DC Bonuses', () => SAVING_THROW_DC_BONUS_NODE_MAP, {
          presentation: 'inline',
          order: 4,
          showIf: or([
            local.field(['dcMethod']).eq(SAVING_THROW_DC_METHOD.FIXED_DC),
            local.field(['dcMethod']).eq(SAVING_THROW_DC_METHOD.DERIVED_DC)
          ])
        })
      )
  }
)
