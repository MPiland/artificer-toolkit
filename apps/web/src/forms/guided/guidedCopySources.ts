import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { loadPagedAuthoredCatalogItems } from '#app/data/authoredCatalogPages'
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
      return { items: await loadPagedAuthoredCatalogItems(api.content.backgrounds.list, backgroundRequest) }
    case 'class':
      return { items: await loadPagedAuthoredCatalogItems(api.content.classes.list, classRequest) }
    case 'creature':
      return { items: await loadPagedAuthoredCatalogItems(api.content.creatures.list, creatureRequest) }
    case 'equipment':
      return { items: await loadPagedAuthoredCatalogItems(api.content.equipment.list, equipmentRequest) }
    case 'feat':
      return { items: await loadPagedAuthoredCatalogItems(api.content.feats.list, featRequest) }
    case 'race':
      return { items: await loadPagedAuthoredCatalogItems(api.content.races.list, raceRequest) }
    case 'spell':
      return { items: await loadPagedAuthoredCatalogItems(api.content.spells.list, spellRequest) }
    case 'vehicle':
      return { items: await loadPagedAuthoredCatalogItems(api.content.vehicles.list, vehicleRequest) }
  }
}

const backgroundRequest = { direction: 'FORWARD', limit: 48, sort: 'name' } as const
const classRequest = { direction: 'FORWARD', limit: 48, sort: 'name' } as const
const creatureRequest = { direction: 'FORWARD', limit: 48, sort: 'name' } as const
const equipmentRequest = { direction: 'FORWARD', limit: 48, sort: 'name' } as const
const featRequest = { direction: 'FORWARD', limit: 48, sort: 'name' } as const
const raceRequest = { direction: 'FORWARD', limit: 48, sort: 'name' } as const
const spellRequest = { direction: 'FORWARD', limit: 48, sort: 'name' } as const
const vehicleRequest = { direction: 'FORWARD', limit: 48, sort: 'name' } as const

export function toGuidedCopySources(response: GuidedCopySourceList): GuidedCopySource[] {
  return copyableItems(response)
}
