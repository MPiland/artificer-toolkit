import type { DamageBonusAuthored, HealBonusAuthored } from '#authored'
import { buildNodeMap } from '#utils'

type OutcomeBonusAuthored = DamageBonusAuthored | HealBonusAuthored

const outcomeBonus = buildNodeMap<OutcomeBonusAuthored>()

export const OUTCOME_BONUS_NODE_MAP = outcomeBonus.define(
  'outcomeBonus',
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
            options: [
              { code: 'ABILITY_BONUS', label: 'Ability Bonus' },
              { code: 'PROFICIENCY_BONUS', label: 'Proficiency Bonus' },
              { code: 'SKILL_BONUS', label: 'Skill Bonus' },
              { code: 'CLASS_LEVEL', label: 'Class Level' }
            ]
          },
          {
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
            requiredIf: true,
            showIf: local.field(['bonusKind']).eq('SKILL_BONUS')
          }
        )
      )
      .set(
        'classId',
        selectSingle(
          ['classId'],
          'Class',
          {
            kind: 'DATA',
            relationship: table('classes', {
              selectColumns: ['id', 'label']
            })
          },
          {
            requiredIf: true,
            showIf: local.field(['bonusKind']).eq('CLASS_LEVEL')
          }
        )
      )
      .set('min', number(['min'], 'Min Amount', { constraints: { minimum: 0 } }))
      .set('max', number(['max'], 'Max Amount', { constraints: { minimum: 0 } }))
      .set('multiplier', number(['multiplier'], 'Multiplier', { constraints: { minimum: 0 } }))
      .set(
        'order',
        number(['order'], 'Order', {
          requiredIf: true
        })
      )
  }
)
