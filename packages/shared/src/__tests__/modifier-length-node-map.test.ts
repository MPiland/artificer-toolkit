import { describe, expect, it } from 'vitest'

import { LENGTH_UNIT_CODES } from '#core'
import { MODIFIER_GRANT_NODE_MAP } from '#maps'
import { AUTHORED_LENGTH_AMOUNT_MAX, evaluateConditionIf, type ConditionIfExpr } from '#utils'
import { MODIFIER_KINDS_BY_DOMAIN } from '../domains/grants/core/modifier.js'

type PayloadNode = {
  kind: string
  type?: string
  showIf?: ConditionIfExpr
  constraints?: { minimum?: number; maximum?: number }
  source?: { kind: string; options?: readonly { code: string }[] }
  nodes?: PayloadNodeMap | (() => PayloadNodeMap)
}
type PayloadNodeMap = { nodes: Record<string, PayloadNode> }

const payloadNodes = (): Record<string, PayloadNode> => {
  const payload = MODIFIER_GRANT_NODE_MAP.nodes.payload as PayloadNode | undefined
  if (payload?.kind !== 'GROUP' || !payload.nodes) throw new Error('Expected a payload group.')
  return (typeof payload.nodes === 'function' ? payload.nodes() : payload.nodes).nodes
}

const node = (key: string): PayloadNode => {
  const found = payloadNodes()[key]
  if (!found) throw new Error(`Expected a ${key} payload node.`)
  return found
}

const shown = (key: string, parentValues: Record<string, unknown>, values = {}) => {
  const { showIf } = node(key)
  return showIf ? evaluateConditionIf(showIf, { values, parentValues }) : true
}

describe('the modifier payload node map for SPEED and SENSE_RANGE (RELIABILITY-5.1)', () => {
  it.each([
    ['SPEED', 'BONUS'],
    ['SPEED', 'PENALTY'],
    ['SPEED', 'SET_VALUE'],
    ['SENSE_RANGE', 'BONUS']
  ])('authors a %s %s as an amount and a unit with no value source', (domain, kind) => {
    const parent = { valueDomainCode: domain, modifierKind: kind }
    expect(shown('lengthAmount', parent)).toBe(true)
    expect(shown('unit', parent)).toBe(true)
    expect(shown('valueKind', parent)).toBe(false)
    expect(shown('bonusAmount', parent, { valueKind: 'FIXED' })).toBe(false)
    expect(shown('amount', parent, { valueKind: 'FIXED' })).toBe(false)
  })

  it('offers a sense range only the modifier kinds the rules apply', () => {
    // A sense range has no SET_VALUE (publication refuses it) and no PENALTY (the contract has none).
    expect(MODIFIER_KINDS_BY_DOMAIN.SENSE_RANGE).toEqual(['BONUS'])
    expect(MODIFIER_KINDS_BY_DOMAIN.SPEED).toEqual(['BONUS', 'PENALTY', 'SET_VALUE'])
  })

  it('keeps the value source and plain amount for other domains, with no unit', () => {
    const parent = { valueDomainCode: 'ARMOR_CLASS', modifierKind: 'BONUS' }
    expect(shown('valueKind', parent)).toBe(true)
    expect(shown('bonusAmount', parent, { valueKind: 'FIXED' })).toBe(true)
    expect(shown('lengthAmount', parent)).toBe(false)
    expect(shown('unit', parent)).toBe(false)
  })

  it('bounds the amount like an authored length and offers exactly the length units', () => {
    expect(node('lengthAmount').constraints).toEqual({
      minimum: 0,
      maximum: AUTHORED_LENGTH_AMOUNT_MAX
    })
    const unit = node('unit')
    expect(unit.source?.options?.map((option) => option.code)).toEqual([...LENGTH_UNIT_CODES])
  })
})
