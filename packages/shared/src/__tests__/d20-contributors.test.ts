import { describe, expect, it } from 'vitest'

import {
  canonicalD20ContributorKey,
  compareCanonicalD20Contributors,
  checksumRuleDocument
} from '../domains/rules/index.js'

describe('canonical d20 contributors', () => {
  it('orders mixed-case, punctuation, and non-ASCII identities by deterministic ordinal keys', () => {
    const contributors = [
      { sourceId: 'é', grantId: null, domainKey: '!', influence: 'DISADVANTAGE' as const },
      { sourceId: 'Z', grantId: 'a-b', domainKey: null, influence: 'ADVANTAGE' as const },
      { sourceId: 'a', grantId: 'a.b', domainKey: '[]', influence: 'ADVANTAGE' as const }
    ]
    const ordered = [...contributors].sort(compareCanonicalD20Contributors)
    expect(ordered.map(canonicalD20ContributorKey)).toEqual([
      canonicalD20ContributorKey(contributors[1]!),
      canonicalD20ContributorKey(contributors[2]!),
      canonicalD20ContributorKey(contributors[0]!)
    ])
    expect(checksumRuleDocument(ordered)).toBe(checksumRuleDocument([...ordered]))
  })
})
