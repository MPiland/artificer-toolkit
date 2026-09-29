import type { AuthoredCatalogueItem } from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { ContentSnapshotKind } from '@artificer-toolkit/schema/api/contentSnapshots'
import type { AuthoredListItem } from '#components/AuthoredList/AuthoredList.types'
import { summarizeAuthoredDescription } from './authoredListMapper'
import { formatClassCategory } from './classes/classListMapper'
import { formatEquipmentCategory } from './equipment/equipmentListMapper'
import { formatCreatureCategory } from './creatures/creatureListMapper'
import { formatVehicleCategory } from './vehicles/vehicleListMapper'
import { formatRaceCategory } from './races/raceListMapper'
import { mapSpellCatalogueItem } from './spells/spellListMapper'

export const authoredCatalogueCategoryFormatters: Partial<
  Record<ContentSnapshotKind, (category: string | undefined) => string>
> = {
  CLASS: formatClassCategory,
  EQUIPMENT: formatEquipmentCategory,
  CREATURE: formatCreatureCategory,
  VEHICLE: formatVehicleCategory,
  RACE: formatRaceCategory
}

export function mapAuthoredCatalogueItems(
  items: AuthoredCatalogueItem[],
  subjectKind: ContentSnapshotKind
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
    filterValues: { source: item.provenance.kind, category: item.category },
    sortValues: { category: formatCategory?.(item.category), name: item.label },
    searchText: item.parentClassLabel ?? item.parentRaceLabel ?? undefined,
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
