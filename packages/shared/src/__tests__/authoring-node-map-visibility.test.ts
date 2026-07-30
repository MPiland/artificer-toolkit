import { describe, expect, it } from 'vitest'

import { CHARGE_LIMIT_KIND, EFFECT_KIND } from '#core'
import { CHARGE_NODE_MAP, PATH_NODE_MAP, PROFICIENCY_NODE_MAP } from '#maps'
import { evaluateConditionIf, type ConditionIfExpr } from '#utils'

describe('authoring node map visibility', () => {
  it('keeps equipment categories independent from selection mode', () => {
    const categoryNode = PROFICIENCY_NODE_MAP.nodes.category
    const equipmentIdsNode = PROFICIENCY_NODE_MAP.nodes.equipmentIds

    expect(
      isVisible(categoryNode, {
        authoringModeKind: 'ALL',
        proficiencyKind: 'EQUIPMENT'
      })
    ).toBe(true)
    expect(
      isVisible(categoryNode, {
        authoringModeKind: 'ALL',
        proficiencyKind: 'EQUIPMENT_PROPERTY'
      })
    ).toBe(true)
    expect(
      isVisible(categoryNode, {
        authoringModeKind: 'SELECTED',
        proficiencyKind: 'EQUIPMENT'
      })
    ).toBe(true)
    expect(
      isVisible(categoryNode, {
        authoringModeKind: 'ALL',
        proficiencyKind: 'SKILL'
      })
    ).toBe(false)

    expect(
      isVisible(equipmentIdsNode, {
        authoringModeKind: 'ALL',
        proficiencyKind: 'EQUIPMENT'
      })
    ).toBe(false)
    expect(
      isVisible(equipmentIdsNode, {
        authoringModeKind: 'SELECTED',
        proficiencyKind: 'EQUIPMENT'
      })
    ).toBe(true)
  })

  it('exposes charge bounds only for derived limits and levels only for fixed per-level scaling', () => {
    const minNode = CHARGE_NODE_MAP.nodes.min
    const maxNode = CHARGE_NODE_MAP.nodes.max
    const levelsNode = CHARGE_NODE_MAP.nodes.levels

    for (const limitKind of [
      CHARGE_LIMIT_KIND.ABILITY_MODIFIER,
      CHARGE_LIMIT_KIND.CHARACTER_LEVEL,
      CHARGE_LIMIT_KIND.CLASS_LEVEL,
      CHARGE_LIMIT_KIND.PARENT_CLASS_LEVEL,
      CHARGE_LIMIT_KIND.SPELL_CAST_LEVEL
    ]) {
      expect(isVisible(minNode, { limitKind })).toBe(true)
      expect(isVisible(maxNode, { limitKind })).toBe(true)
    }

    expect(isVisible(minNode, { limitKind: CHARGE_LIMIT_KIND.FIXED_AMOUNT })).toBe(false)
    expect(isVisible(maxNode, { limitKind: CHARGE_LIMIT_KIND.FIXED_AMOUNT })).toBe(false)
    expect(
      isVisible(levelsNode, {
        limitKind: CHARGE_LIMIT_KIND.FIXED_AMOUNT,
        scalingKind: 'PER_LEVEL'
      })
    ).toBe(true)
    expect(
      isVisible(levelsNode, {
        limitKind: CHARGE_LIMIT_KIND.FIXED_AMOUNT,
        scalingKind: 'NONE'
      })
    ).toBe(false)
    expect(
      isVisible(levelsNode, {
        limitKind: CHARGE_LIMIT_KIND.CHARACTER_LEVEL,
        scalingKind: 'PER_LEVEL'
      })
    ).toBe(false)
  })

  it('offers source charge consumption only when a containing authored source owns a pool', () => {
    const limitKindNode = CHARGE_NODE_MAP.nodes.limitKind
    const costNode = CHARGE_NODE_MAP.nodes.cost
    const resetKindNode = CHARGE_NODE_MAP.nodes.resetKind

    if (
      !limitKindNode ||
      limitKindNode.kind !== 'INPUT' ||
      limitKindNode.type !== 'SELECT_SINGLE' ||
      limitKindNode.source.kind !== 'INLINE_GROUPS'
    ) {
      throw new Error('Expected charge limit kind to use conditional inline groups')
    }

    const optionsWithoutSource = limitKindNode.source.optionGroups
      .filter((group) =>
        evaluateConditionIf(group.showIf, {
          values: {},
          ancestors: [{ attributes: ['LIMITED_USE'] }]
        })
      )
      .flatMap((group) => group.options)
    const optionsWithSource = limitKindNode.source.optionGroups
      .filter((group) =>
        evaluateConditionIf(group.showIf, {
          values: {},
          ancestors: [
            { id: 'feature' },
            { attributes: ['LIMITED_USE'] }
          ]
        })
      )
      .flatMap((group) => group.options)

    expect(optionsWithoutSource.some((option) => option.code === 'SOURCE_CHARGES')).toBe(false)
    expect(optionsWithSource.some((option) => option.code === 'SOURCE_CHARGES')).toBe(true)
    expect(isVisible(costNode, { limitKind: 'SOURCE_CHARGES' })).toBe(true)
    expect(isVisible(resetKindNode, { limitKind: 'SOURCE_CHARGES' })).toBe(false)
  })

  it('exposes damage multipliers for every value kind and heal multipliers only for pools', () => {
    const resultBlockNode = PATH_NODE_MAP.nodes.resultBlock

    if (!resultBlockNode || resultBlockNode.kind !== 'GROUP') {
      throw new Error('Expected resultBlock to be a group node')
    }

    const resultBlockMap =
      typeof resultBlockNode.nodes === 'function' ? resultBlockNode.nodes() : resultBlockNode.nodes
    const outcomesNode = resultBlockMap.nodes.outcomes

    if (!outcomesNode || outcomesNode.kind !== 'GROUP') {
      throw new Error('Expected outcomes to be a group node')
    }

    const outcomeMap =
      typeof outcomesNode.nodes === 'function' ? outcomesNode.nodes() : outcomesNode.nodes
    const multiplierNode = outcomeMap.nodes.multiplier

    for (const valueKind of ['FIXED', 'DICE', 'POOL']) {
      expect(
        isVisible(multiplierNode, {
          effectKind: EFFECT_KIND.DAMAGE,
          valueKind
        })
      ).toBe(true)
    }
    expect(
      isVisible(multiplierNode, {
        effectKind: EFFECT_KIND.HEAL,
        valueKind: 'POOL'
      })
    ).toBe(true)
    expect(
      isVisible(multiplierNode, {
        effectKind: EFFECT_KIND.HEAL,
        valueKind: 'FIXED'
      })
    ).toBe(false)
  })
})

function isVisible(node: { showIf?: ConditionIfExpr }, values: Record<string, unknown>) {
  return node.showIf ? evaluateConditionIf(node.showIf, { values }) : true
}
