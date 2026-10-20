import { describe, expect, it } from 'vitest'

import { featureEffectDtoSchema } from '../effects/effect.js'

const id = '00000000-0000-4000-8000-000000000001'

function effect(kind: 'ACTION' | 'PASSIVE', extra: Record<string, unknown>) {
  return {
    id,
    order: 1,
    ...extra,
    invocation: {
      kind,
      triggerCode: 'ACTIVATED',
      ...(kind === 'ACTION' ? { activation: { code: 'ACTION', amount: 3 } } : {}),
      range: { id: `${id}-range`, rangeKind: 'SPECIAL' }
    },
    paths: []
  }
}

function issues(value: unknown) {
  const result = featureEffectDtoSchema.safeParse(value)
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
}

describe('Feature effect grantedSpellCast (SPELLS-33.T6c, D156)', () => {
  it('accepts an action that casts a granted spell with no paths of its own', () => {
    const result = featureEffectDtoSchema.safeParse(
      effect('ACTION', { grantedSpellCast: { spellKind: 'LEVELED' } })
    )
    expect(result.error?.issues).toBeUndefined()
    expect(result.data?.grantedSpellCast).toEqual({ spellKind: 'LEVELED' })
  })

  it('still requires a path on an effect that casts nothing', () => {
    expect(issues(effect('ACTION', {}))).toEqual([
      { path: ['paths'], message: 'An effect needs at least one outcome path.' }
    ])
  })

  it('refuses an unknown spell kind, a passive effect, and a fixed cast level beside it', () => {
    expect(issues(effect('ACTION', { grantedSpellCast: { spellKind: 'RITUAL' } })).length).toBe(1)
    expect(issues(effect('PASSIVE', { grantedSpellCast: { spellKind: 'CANTRIP' } }))).toEqual([
      { path: ['grantedSpellCast'], message: 'Only an action can cast a granted spell.' }
    ])
    expect(
      issues(
        effect('ACTION', {
          grantedSpellCast: { spellKind: 'CANTRIP' },
          spellCast: { castLevel: 3 }
        })
      )
    ).toEqual([
      {
        path: ['spellCast'],
        message: 'A granted spell names its own level when cast, so the action names none.'
      }
    ])
  })
})
