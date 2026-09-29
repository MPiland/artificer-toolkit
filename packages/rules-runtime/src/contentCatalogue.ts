import type {
  AuthoredCatalogueItem,
  AuthoredCatalogueSummary
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import type {
  ContentSnapshotKind,
  ContentSnapshotListEntry,
  ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'

/**
 * Read side of the authored-content lists: the same rows, order and facets the retired Convex
 * catalogue queries produced, computed from the visible sources' `list` parts. Imports schema
 * only, so the web bundle can use it without reaching the rules kernel.
 */
export type ContentCatalogueSource = {
  [Kind in ContentSnapshotKind]: {
    subjectKind: Kind
    systemId: string
    sourceKind: 'PLATFORM' | 'USER'
    roots: readonly ContentSnapshotListEntry<Kind>[]
  }
}[ContentSnapshotKind]

/**
 * A list part with the manifest facts (System, PLATFORM or USER) its rows are read under; any other
 * part of the scope is not a catalogue source.
 */
export function toContentCatalogueSource(
  object: ContentSnapshotObject,
  source: { systemId: string; kind: 'PLATFORM' | 'USER' }
): ContentCatalogueSource | undefined {
  if (object.part !== 'list') return undefined
  // `subjectKind` and `roots` stay correlated, which TypeScript cannot follow across the copy.
  return {
    subjectKind: object.kind,
    systemId: source.systemId,
    sourceKind: source.kind,
    roots: object.roots
  } as ContentCatalogueSource
}

export type ContentCatalogueSort = 'name' | 'category' | 'family' | 'level' | 'school'

const parentKey = (systemId: string, id: string) => `${systemId}:${id.toLowerCase()}`

function readBaseLabels(
  sources: readonly ContentCatalogueSource[],
  subjectKind: 'CLASS' | 'RACE'
): ReadonlyMap<string, string> {
  const labels = new Map<string, string>()
  for (const source of sources) {
    if (source.subjectKind !== subjectKind) continue
    for (const root of source.roots)
      if (root.category === 'BASE') labels.set(parentKey(source.systemId, root.id), root.label)
  }
  return labels
}

/**
 * The visible items of one kind. A parent (Subclass, Subrace) or a Spell's Class resolves only to
 * a visible root of the same System; an unresolved reference is left off, so the row lists on its own.
 */
export function buildContentCatalogueItems(
  subjectKind: ContentSnapshotKind,
  sources: readonly ContentCatalogueSource[],
  viewerUserId: string
): AuthoredCatalogueItem[] {
  const classLabels =
    subjectKind === 'CLASS' || subjectKind === 'SPELL' ? readBaseLabels(sources, 'CLASS') : null
  const raceLabels = subjectKind === 'RACE' ? readBaseLabels(sources, 'RACE') : null
  const items: AuthoredCatalogueItem[] = []
  for (const source of sources) {
    if (source.subjectKind !== subjectKind) continue
    const owned = source.sourceKind === 'USER'
    const base = (root: ContentSnapshotListEntry, systemId: string) => ({
      id: root.id,
      publicId: root.publicId,
      systemId,
      label: root.label,
      description: root.description ?? null,
      provenance: {
        kind: owned ? ('OWNED' as const) : ('MASTER' as const),
        ownerUserId: owned ? viewerUserId : null
      },
      permissions: { canView: true, canEdit: owned, canCopy: true, canDelete: owned }
    })
    switch (source.subjectKind) {
      case 'CLASS':
        for (const root of source.roots) {
          const parentLabel =
            root.category === 'SUBCLASS'
              ? classLabels?.get(parentKey(source.systemId, root.parentClassId))
              : undefined
          items.push({
            ...base(root, source.systemId),
            category: root.category,
            ...(root.category === 'SUBCLASS' && parentLabel !== undefined
              ? { parentClassId: root.parentClassId, parentClassLabel: parentLabel }
              : {})
          })
        }
        break
      case 'RACE':
        for (const root of source.roots) {
          const parentLabel =
            root.category === 'SUBRACE'
              ? raceLabels?.get(parentKey(source.systemId, root.parentRaceId))
              : undefined
          items.push({
            ...base(root, source.systemId),
            category: root.category,
            ...(root.category === 'BASE' ? { selectionMode: root.selectionMode } : {}),
            ...(root.category === 'SUBRACE' && parentLabel !== undefined
              ? { parentRaceId: root.parentRaceId, parentRaceLabel: parentLabel }
              : {})
          })
        }
        break
      case 'EQUIPMENT':
      case 'CREATURE':
      case 'VEHICLE':
        for (const root of source.roots)
          items.push({ ...base(root, source.systemId), category: root.category })
        break
      case 'SPELL':
        for (const root of source.roots) {
          const resolved = root.classIds.flatMap((id) => {
            const label = classLabels?.get(parentKey(source.systemId, id))
            return label === undefined ? [] : [{ id, label }]
          })
          items.push({
            ...base(root, source.systemId),
            classIds: resolved.map(({ id }) => id),
            classLabels: resolved.map(({ label }) => label),
            level: root.level,
            magicSchoolId: root.magicSchoolId,
            magicSchoolLabel: root.magicSchoolLabel,
            castingTimeUnit: root.castingTime.unit,
            castingTimeAmount: root.castingTime.amount
          })
        }
        break
      case 'BACKGROUND':
      case 'FEAT':
        for (const root of source.roots) items.push(base(root, source.systemId))
        break
    }
  }
  return items
}

const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0)

/** Ordering keys as the Convex indexes compared them: lowercase name, then id. */
function sortKey(item: AuthoredCatalogueItem, sort: ContentCatalogueSort): (string | number)[] {
  const nameKey = item.label.toLowerCase()
  switch (sort) {
    case 'name':
      return [nameKey, item.id]
    case 'category':
      return [item.category ?? '', nameKey, item.id]
    case 'family': {
      const parentId = item.parentClassId ?? item.parentRaceId
      const parentLabel = item.parentClassLabel ?? item.parentRaceLabel
      return [
        (parentLabel ?? item.label).toLowerCase(),
        parentId ?? item.id,
        item.category ?? '',
        nameKey,
        item.id
      ]
    }
    case 'level':
      return [item.level ?? 0, nameKey, item.id]
    case 'school':
      return [(item.magicSchoolLabel ?? '').toLowerCase(), nameKey, item.id]
  }
}

function compareKeys(left: (string | number)[], right: (string | number)[]) {
  for (const [index, l] of left.entries()) {
    const r = right[index]
    const order =
      typeof l === 'number' && typeof r === 'number' ? l - r : compareText(String(l), String(r))
    if (order !== 0) return order
  }
  return 0
}

export function sortContentCatalogueItems(
  items: readonly AuthoredCatalogueItem[],
  sort: ContentCatalogueSort
): AuthoredCatalogueItem[] {
  return items
    .map((item) => ({ item, key: sortKey(item, sort) }))
    .sort((left, right) => compareKeys(left.key, right.key))
    .map(({ item }) => item)
}

const byLabelThenId = (left: { id: string; label: string }, right: { id: string; label: string }) =>
  left.label.localeCompare(right.label) || left.id.localeCompare(right.id)

/** Counts, categories and Spell facets over every visible row, independent of the selected filters. */
export function summarizeContentCatalogue(
  subjectKind: ContentSnapshotKind,
  items: readonly AuthoredCatalogueItem[]
): AuthoredCatalogueSummary {
  const masterCount = items.filter((item) => item.provenance.kind === 'MASTER').length
  const summary = {
    activeCount: items.length,
    masterCount,
    ownedCount: items.length - masterCount,
    categories: [
      ...new Set(items.flatMap((item) => (item.category === undefined ? [] : [item.category])))
    ].sort()
  }
  if (subjectKind !== 'SPELL') return summary
  const classes = new Map<string, string>()
  const schools = new Map<string, string>()
  const levels = new Set<number>()
  for (const spell of items) {
    spell.classIds?.forEach((id, index) => {
      const label = spell.classLabels?.[index]
      if (label !== undefined) classes.set(id, label)
    })
    if (spell.magicSchoolId !== undefined && spell.magicSchoolLabel !== undefined)
      schools.set(spell.magicSchoolId, spell.magicSchoolLabel)
    if (spell.level !== undefined) levels.add(spell.level)
  }
  return {
    ...summary,
    spellFacets: {
      classes: [...classes].map(([id, label]) => ({ id, label })).sort(byLabelThenId),
      schools: [...schools].map(([id, label]) => ({ id, label })).sort(byLabelThenId),
      levels: [...levels].sort((left, right) => left - right).map((id) => ({ id }))
    }
  }
}
