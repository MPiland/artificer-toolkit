import {
  authoredFractionSchema,
  authoredLengthSchema
} from '@artificer-toolkit/schema/shared/authoredLimits'
import { describe, expect, it } from 'vitest'

import { srdBaselineContent } from './index.js'

type LengthModifierGrant = { valueDomainCode: string; modifierKind: string; payload: unknown }

/** Every SPEED or SENSE_RANGE modifier grant anywhere in the authored content. */
function lengthModifierGrants(value: unknown): LengthModifierGrant[] {
  if (Array.isArray(value)) return value.flatMap(lengthModifierGrants)
  if (typeof value !== 'object' || value === null) return []
  const entry = value as Record<string, unknown>
  const own =
    entry.grantKind === 'MODIFIER_GRANT' &&
    (entry.valueDomainCode === 'SPEED' || entry.valueDomainCode === 'SENSE_RANGE')
      ? [entry as LengthModifierGrant]
      : []
  return [...own, ...Object.values(entry).flatMap(lengthModifierGrants)]
}

describe('SRD speed and sense range modifiers (RELIABILITY-5.1)', () => {
  const grants = lengthModifierGrants(srdBaselineContent)

  it('carries a bonus, a penalty, a set value and a multiplier, so the corpus exercises every kind', () => {
    const kinds = new Set(
      grants.filter((grant) => grant.valueDomainCode === 'SPEED').map((grant) => grant.modifierKind)
    )
    expect([...kinds].sort()).toEqual(['BONUS', 'MULTIPLY', 'PENALTY', 'SET_VALUE'])
  })

  it('authors every one as a length with an amount and a unit, a multiplier as a fraction', () => {
    const malformed = grants.filter(
      (grant) =>
        !(
          grant.modifierKind === 'MULTIPLY' ? authoredFractionSchema : authoredLengthSchema
        ).safeParse(grant.payload).success
    )
    expect(malformed).toEqual([])
  })
})
