export interface CanonicalD20Contributor {
  sourceId: string
  grantId?: string | null
  domainKey?: string | null
  influence: 'ADVANTAGE' | 'DISADVANTAGE'
}

export function canonicalD20ContributorKey(input: CanonicalD20Contributor): string {
  return `${input.sourceId}\u0000${input.grantId ?? ''}\u0000${input.domainKey ?? ''}\u0000${input.influence}`
}

export function compareCanonicalD20Contributors(
  left: CanonicalD20Contributor,
  right: CanonicalD20Contributor
): number {
  const leftKey = canonicalD20ContributorKey(left)
  const rightKey = canonicalD20ContributorKey(right)
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
}
