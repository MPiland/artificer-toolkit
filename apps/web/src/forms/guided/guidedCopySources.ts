import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'

export type GuidedCopySource = {
  category?: string
  castingTime?: string
  description: string
  id: string
  label: string
  level?: number
  source: 'Homebrew' | 'SRD'
}

export type GuidedCopySourceList = {
  items: readonly {
    description?: string | null
    id: string
    label: string
    category?: string | null
    level?: number | null
    castingTimeAmount?: number | null
    castingTimeUnit?: string | null
    permissions: { canCopy: boolean }
    provenance: { kind: string }
  }[]
}

function copyableItems(response: GuidedCopySourceList): GuidedCopySource[] {
  return response.items
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

export function getGuidedCopySourceQueryKey(domain: AuthoredFormDomain) {
  switch (domain) {
    case 'background':
      return queryKeys.content.backgrounds.list()
    case 'class':
      return queryKeys.content.classes.list()
    case 'creature':
      return queryKeys.content.creatures.list()
    case 'equipment':
      return queryKeys.content.equipment.list()
    case 'feat':
      return queryKeys.content.feats.list()
    case 'race':
      return queryKeys.content.races.list()
    case 'spell':
      return queryKeys.content.spells.list()
    case 'vehicle':
      return queryKeys.content.vehicles.list()
  }
}

export async function getGuidedCopySources(
  domain: AuthoredFormDomain
): Promise<GuidedCopySourceList> {
  switch (domain) {
    case 'background':
      return api.content.backgrounds.list()
    case 'class':
      return api.content.classes.list()
    case 'creature':
      return api.content.creatures.list()
    case 'equipment':
      return api.content.equipment.list()
    case 'feat':
      return api.content.feats.list()
    case 'race':
      return api.content.races.list()
    case 'spell':
      return api.content.spells.list()
    case 'vehicle':
      return api.content.vehicles.list()
  }
}

export function toGuidedCopySources(response: GuidedCopySourceList): GuidedCopySource[] {
  return copyableItems(response)
}
