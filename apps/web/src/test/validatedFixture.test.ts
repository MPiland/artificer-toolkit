import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { validated } from './validatedFixture'

describe('validated fixture', () => {
  const validatedNamed = validated(z.object({ name: z.string() }))

  it('returns a fixture that satisfies its schema unchanged', () => {
    const fixture = { name: 'Longbow' }
    expect(validatedNamed(fixture)).toBe(fixture)
  })

  it('rejects a fixture that breaks its schema, so a contract change fails the fixture first', () => {
    // @ts-expect-error the literal is deliberately off-contract
    expect(() => validatedNamed({ name: 3 })).toThrow()
  })
})
