import { describe, expect, it } from 'vitest'

import { featureEffectDtoSchema } from '../effects/effect.js'

const id = '00000000-0000-4000-8000-000000000001'

function effect(
  invocation: { kind: 'ACTION' | 'PASSIVE'; triggerCode: string },
  extra: Record<string, unknown>
) {
  return {
    id,
    order: 1,
    ...extra,
    invocation: {
      ...invocation,
      ...(invocation.kind === 'ACTION' ? { activation: { code: 'ACTION', amount: 1 } } : {}),
      range: { id: `${id}-range`, rangeKind: 'SELF' }
    },
    paths: [
      {
        id: '00000000-0000-4000-8000-000000000101',
        order: 1,
        pathCode: 'ON_HIT',
        groupType: 'SINGLE',
        selectionKind: 'FIXED',
        resultBlock: { id: `${id}-result`, resultKind: 'SINGLE', outcomes: [] }
      }
    ]
  }
}

const action = { kind: 'ACTION', triggerCode: 'ACTIVATED' } as const
const passive = { kind: 'PASSIVE', triggerCode: 'ACTIVATED' } as const

function spellCastIssues(value: unknown) {
  const result = featureEffectDtoSchema.safeParse(value)
  return result.success
    ? []
    : result.error.issues
        .filter((issue) => issue.path[0] === 'spellCast')
        .map((issue) => issue.message)
}

describe('Feature effect spellCast', () => {
  it('accepts an authored cast level on an action', () => {
    const result = featureEffectDtoSchema.safeParse(effect(action, { spellCast: { castLevel: 3 } }))
    expect(result.success).toBe(true)
    expect(result.data?.spellCast).toEqual({ castLevel: 3 })
  })

  it('requires a cast level', () => {
    expect(spellCastIssues(effect(action, { spellCast: {} })).length).toBeGreaterThan(0)
  })

  it('bounds the cast level to a spell level', () => {
    expect(spellCastIssues(effect(action, { spellCast: { castLevel: 0 } })).length).toBeGreaterThan(
      0
    )
    expect(spellCastIssues(effect(action, { spellCast: { castLevel: 10 } })).length).toBeGreaterThan(
      0
    )
  })

  it('refuses a cast on a passive effect', () => {
    expect(spellCastIssues(effect(passive, { spellCast: { castLevel: 3 } })).length).toBeGreaterThan(
      0
    )
  })
})
