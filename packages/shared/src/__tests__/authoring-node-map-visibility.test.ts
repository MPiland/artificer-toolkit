import { describe, expect, it } from 'vitest'

import { CHARGE_LIMIT_KIND, EFFECT_KIND } from '#core'
import {
  CHARGE_NODE_MAP,
  MODIFIER_GRANT_NODE_MAP,
  PATH_NODE_MAP,
  PROFICIENCY_NODE_MAP
} from '#maps'
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
          ancestors: [{ id: 'feature' }, { attributes: ['LIMITED_USE'] }]
        })
      )
      .flatMap((group) => group.options)

    expect(optionsWithoutSource.some((option) => option.code === 'SOURCE_CHARGES')).toBe(false)
    expect(optionsWithSource.some((option) => option.code === 'SOURCE_CHARGES')).toBe(true)
    expect(isVisible(costNode, { limitKind: 'SOURCE_CHARGES' })).toBe(true)
    expect(isVisible(resetKindNode, { limitKind: 'SOURCE_CHARGES' })).toBe(false)
  })

  it('exposes nonnegative damage multipliers and heal multipliers only for pools', () => {
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
    const damageMultiplierNode = outcomeMap.nodes.damageMultiplier
    const healMultiplierNode = outcomeMap.nodes.multiplier

    for (const valueKind of ['FIXED', 'DICE', 'POOL']) {
      expect(
        isVisible(damageMultiplierNode, {
          effectKind: EFFECT_KIND.DAMAGE,
          valueKind
        })
      ).toBe(true)
    }
    expectNumberMinimum(damageMultiplierNode, 0)
    expect(
      isVisible(healMultiplierNode, {
        effectKind: EFFECT_KIND.HEAL,
        valueKind: 'POOL'
      })
    ).toBe(true)
    expect(
      isVisible(healMultiplierNode, {
        effectKind: EFFECT_KIND.HEAL,
        valueKind: 'FIXED'
      })
    ).toBe(false)
  })

  it('edits a Grappled outcome: held at once, escape checks and a fixed or contested DC (D105)', () => {
    const outcome = groupMap(groupMap(PATH_NODE_MAP.nodes.resultBlock)('outcomes'))
    const heldAtOnceNode = outcome('actorRelationshipHeldAtOnce')
    const modulesNode = outcome('actorRelationshipModules')

    expect(isVisible(heldAtOnceNode, { effectKind: EFFECT_KIND.ACTOR_RELATIONSHIP })).toBe(true)
    expect(isVisible(heldAtOnceNode, { effectKind: EFFECT_KIND.CONDITION })).toBe(false)
    expectNumberMinimum(heldAtOnceNode, 1)
    expect(isVisible(modulesNode, { effectKind: EFFECT_KIND.ACTOR_RELATIONSHIP })).toBe(true)

    const moduleNode = groupMap(modulesNode)
    const kindNode = moduleNode('kind')
    if (kindNode.kind !== 'INPUT' || kindNode.source?.kind !== 'INLINE_OPTIONS') {
      throw new Error('Expected module kind to be an inline select')
    }
    const kindCodes = kindNode.source.options?.map((option) => option.code)
    expect(kindCodes).toContain('ESCAPE_CHECK')
    expect(kindCodes).not.toContain('SOURCE_EXCLUSIVE_TARGET')
    for (const key of ['activation', 'checks', 'dc', 'actorKinds']) {
      expect(isVisible(moduleNode(key), { kind: 'ESCAPE_CHECK' })).toBe(true)
      expect(isVisible(moduleNode(key), { kind: 'TARGET_SIZE_MAXIMUM' })).toBe(false)
    }

    const checksNode = moduleNode('checks')
    const checkMap = typeof checksNode.nodes === 'function' ? checksNode.nodes() : checksNode.nodes
    expect(Object.keys(checkMap?.nodes ?? {})).toEqual(['skillIds', 'abilityDefinitionIds'])

    const dcNode = groupMap(moduleNode('dc'))
    expect(isVisible(dcNode('value'), { kind: 'FIXED' })).toBe(true)
    expect(isVisible(dcNode('value'), { kind: 'CONTEST' })).toBe(false)
    expectNumberMinimum(dcNode('value'), 1)
    expect(isVisible(dcNode('checks'), { kind: 'CONTEST' })).toBe(true)
    expect(isVisible(dcNode('checks'), { kind: 'FIXED' })).toBe(false)
  })

  it('asks for a damage type unless the outcome takes the triggering weapon’s (D119)', () => {
    const outcome = groupMap(groupMap(PATH_NODE_MAP.nodes.resultBlock)('outcomes'))
    const toggleNode = outcome('usesTriggeringWeaponDamageType')
    const damageTypeNode = outcome('damageTypeId')
    const damage = { effectKind: EFFECT_KIND.DAMAGE }

    expect(isVisible(toggleNode, damage)).toBe(true)
    expect(isVisible(toggleNode, { effectKind: EFFECT_KIND.HEAL })).toBe(false)

    for (const values of [damage, { ...damage, usesTriggeringWeaponDamageType: false }]) {
      expect(isVisible(damageTypeNode, values)).toBe(true)
      expect(isRequired(damageTypeNode, values)).toBe(true)
    }
    const weaponType = { ...damage, usesTriggeringWeaponDamageType: true }
    expect(isVisible(damageTypeNode, weaponType)).toBe(false)
    expect(isRequired(damageTypeNode, weaponType)).toBe(false)
  })

  it('mirrors nonnegative bonus controls without constraining penalties', () => {
    const payloadNode = MODIFIER_GRANT_NODE_MAP.nodes.payload

    if (!payloadNode || payloadNode.kind !== 'GROUP') {
      throw new Error('Expected modifier payload to be a group node')
    }

    const payloadMap =
      typeof payloadNode.nodes === 'function' ? payloadNode.nodes() : payloadNode.nodes

    expectNumberMinimum(payloadMap.nodes.bonusAmount, 0)
    expectNumberMinimum(payloadMap.nodes.bonusMultiplier, 0)
    expectNumberMinimum(payloadMap.nodes.bonusMin, 0)
    expectNumberMinimum(payloadMap.nodes.bonusMax, 0)
    expectNumberMinimum(payloadMap.nodes.amount, undefined)
    expectNumberMinimum(payloadMap.nodes.multiplier, undefined)
  })
})

function isVisible(node: { showIf?: ConditionIfExpr }, values: Record<string, unknown>) {
  return node.showIf ? evaluateConditionIf(node.showIf, { values }) : true
}

function isRequired(
  node: { requiredIf?: ConditionIfExpr | true },
  values: Record<string, unknown>
) {
  if (node.requiredIf === undefined) return false
  return node.requiredIf === true || evaluateConditionIf(node.requiredIf, { values })
}

type VisibilityNode = {
  kind: string
  showIf?: ConditionIfExpr
  requiredIf?: ConditionIfExpr | true
  type?: string
  constraints?: { minimum?: number }
  source?: { kind: string; options?: readonly { code: string }[] }
  nodes?: VisibilityNodeMap | (() => VisibilityNodeMap)
}
type VisibilityNodeMap = { nodes: Record<string, VisibilityNode> }

function groupMap(node: VisibilityNode | undefined) {
  if (!node || node.kind !== 'GROUP' || !node.nodes) {
    throw new Error('Expected a group node')
  }
  const map = typeof node.nodes === 'function' ? node.nodes() : node.nodes
  return (key: string) => {
    const child = map.nodes[key]
    if (!child) throw new Error(`Expected a ${key} node`)
    return child
  }
}

function expectNumberMinimum(
  node:
    | {
        kind: string
        type?: string
        constraints?: { minimum?: number }
      }
    | undefined,
  minimum: number | undefined
) {
  if (!node || node.kind !== 'INPUT' || node.type !== 'NUMBER') {
    throw new Error('Expected a number input node')
  }

  expect(node.constraints?.minimum).toBe(minimum)
}
