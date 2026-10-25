import type { NumericAtom, NumericExpr } from '#core'
import { NUMERIC_EXPR, NUMERIC_EXPR_CODE } from '#core'
import { buildNodeMap, type NodeMap, valuesOf } from '#utils'

const NUMERIC_ATOM_OPTIONS = valuesOf(NUMERIC_EXPR).filter(
  (option) =>
    option.code !== NUMERIC_EXPR_CODE.ADD &&
    option.code !== NUMERIC_EXPR_CODE.CLAMP &&
    option.code !== NUMERIC_EXPR_CODE.MUL
)

const NUMERIC_EXPR_OPTIONS = valuesOf(NUMERIC_EXPR).filter(
  (option) => option.code !== NUMERIC_EXPR_CODE.ADD && option.code !== NUMERIC_EXPR_CODE.CLAMP
)

const numericAtom = buildNodeMap<NumericAtom>()
const numericExpr = buildNodeMap<NumericExpr>()

const NUMERIC_ATOM_NODE_MAP: NodeMap<NumericAtom> = numericAtom.define(
  'numericAtom',
  ({ map, nodes, cond, data }) => {
    const { selectSingle, number } = nodes
    const local = cond.local()
    const { table } = data

    map
      .set(
        'kind',
        selectSingle(
          ['kind'],
          'Value Source',
          {
            kind: 'INLINE_OPTIONS',
            options: NUMERIC_ATOM_OPTIONS
          },
          {
            requiredIf: true
          }
        )
      )
      .set(
        'value',
        number(['value'], 'Value', {
          requiredIf: true,
          showIf: local.field(['kind']).eq(NUMERIC_EXPR_CODE.FIXED)
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
            requiredIf: true,
            showIf: local.field(['kind']).eq(NUMERIC_EXPR_CODE.ABILITY_MODIFIER)
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
            showIf: local.field(['kind']).eq(NUMERIC_EXPR_CODE.SKILL_BONUS)
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
            showIf: local.field(['kind']).eq(NUMERIC_EXPR_CODE.CLASS_LEVEL)
          }
        )
      )
  }
)

export const NUMERIC_EXPR_NODE_MAP: NodeMap<NumericExpr> = numericExpr.define(
  'numericExpr',
  ({ map, nodes, cond, data }) => {
    const { selectSingle, number, groupObject } = nodes
    const local = cond.local()
    const { table } = data

    map
      .set(
        'kind',
        selectSingle(
          ['kind'],
          'Expression Type',
          {
            kind: 'INLINE_OPTIONS',
            options: NUMERIC_EXPR_OPTIONS
          },
          {
            requiredIf: true
          }
        )
      )
      .set(
        'value',
        number(['value'], 'Value', {
          requiredIf: true,
          showIf: local.field(['kind']).eq(NUMERIC_EXPR_CODE.FIXED)
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
            requiredIf: true,
            showIf: local.field(['kind']).eq(NUMERIC_EXPR_CODE.ABILITY_MODIFIER)
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
            showIf: local.field(['kind']).eq(NUMERIC_EXPR_CODE.SKILL_BONUS)
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
            showIf: local.field(['kind']).eq(NUMERIC_EXPR_CODE.CLASS_LEVEL)
          }
        )
      )
      .set(
        'left',
        groupObject(['left'], 'Left', () => NUMERIC_ATOM_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true,
          showIf: local.field(['kind']).eq(NUMERIC_EXPR_CODE.MUL)
        })
      )
      .set(
        'right',
        groupObject(['right'], 'Right', () => NUMERIC_ATOM_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true,
          showIf: local.field(['kind']).eq(NUMERIC_EXPR_CODE.MUL)
        })
      )
  }
)
