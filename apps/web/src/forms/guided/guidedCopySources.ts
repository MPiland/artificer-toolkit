import type { AuthoredCataloguePage } from '@artificer-toolkit/schema/api/authoredCatalogue'

export type GuidedCopySource = {
  category?: string
  castingTime?: string
  description: string
  id: string
  label: string
  level?: number
  source: 'Homebrew' | 'SRD'
}

export function toGuidedCopySources(
  items: readonly AuthoredCataloguePage['page'][number][]
): GuidedCopySource[] {
  return items
    .filter((item) => item.permissions.canCopy)
    .map((item) => ({
      description: item.description?.replace(/<[^>]*>/g, '').trim() || 'No description yet.',
      id: item.id,
      label: item.label,
      category: item.category ?? undefined,
      level: item.level ?? undefined,
      castingTime:
        item.castingTimeAmount && item.castingTimeUnit
          ? `${item.castingTimeAmount} ${formatCastingTimeUnit(item.castingTimeUnit)}`
          : undefined,
      source: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew'
    }))
}

function formatCastingTimeUnit(unit: string): string {
  return unit.toLowerCase().replaceAll('_', ' ')
}
