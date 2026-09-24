import type {
  AuthoredCataloguePage,
  AuthoredCatalogueReadInput,
  AuthoredCatalogueSearchInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { api } from '@artificer-toolkit/apis/convex/api'
import { convexQuery } from '@convex-dev/react-query'
import type { AuthoredListItem } from '#components/AuthoredList/AuthoredList.types'
import { summarizeAuthoredDescription } from './authoredListMapper'
import { formatClassCategory } from './classes/classListMapper'
import { formatEquipmentCategory } from './equipment/equipmentListMapper'
import { formatCreatureCategory } from './creatures/creatureListMapper'
import { formatVehicleCategory } from './vehicles/vehicleListMapper'
import { formatRaceCategory } from './races/raceListMapper'
import { mapSpellCatalogueItem } from './spells/spellListMapper'

export const authoredCatalogueCategoryFormatters: Partial<
  Record<AuthoredCatalogueReadInput['subjectKind'], (category: string | undefined) => string>
> = {
  CLASS: formatClassCategory,
  EQUIPMENT: formatEquipmentCategory,
  CREATURE: formatCreatureCategory,
  VEHICLE: formatVehicleCategory,
  RACE: formatRaceCategory
}

export function getAuthoredCatalogueSearch(input: AuthoredCatalogueSearchInput | null) {
  return { ...convexQuery(api.content.catalogue.search, input ?? 'skip'), gcTime: 0 }
}

export function getAuthoredCatalogueList(input: AuthoredCatalogueReadInput) {
  return { ...convexQuery(api.content.catalogue.list, input), gcTime: 0 }
}

export function mapAuthoredCatalogueItems(
  items: AuthoredCataloguePage['page'],
  subjectKind: AuthoredCatalogueSearchInput['subjectKind']
): AuthoredListItem[] {
  if (subjectKind === 'SPELL') return items.map(mapSpellCatalogueItem)
  const formatCategory = authoredCatalogueCategoryFormatters[subjectKind]
  return items.map((item) => ({
    id: item.id,
    publicId: item.publicId,
    name: item.label,
    description: summarizeAuthoredDescription(item.description),
    attributes:
      subjectKind === 'RACE'
        ? undefined
        : formatCategory
          ? { Category: formatCategory(item.category) }
          : {},
    badges:
      subjectKind === 'RACE' && (item.category === 'SUBRACE' || item.selectionMode === 'DIRECT')
        ? ['Playable']
        : undefined,
    hierarchy: item.parentClassId
      ? { level: 1, parentId: item.parentClassId, parentLabel: item.parentClassLabel ?? undefined }
      : item.parentRaceId
        ? { level: 1, parentId: item.parentRaceId, parentLabel: item.parentRaceLabel ?? undefined }
        : undefined,
    contentState: 'active',
    sourceLabel: item.provenance.kind === 'MASTER' ? 'SRD' : 'Homebrew',
    sourceKind: item.provenance.kind === 'MASTER' ? 'master' : 'owned',
    permissions: item.permissions
  }))
}
