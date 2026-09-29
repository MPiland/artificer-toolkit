import { describe, expect, it } from 'vitest'

import {
  buildContentCatalogueItems,
  sortContentCatalogueItems,
  summarizeContentCatalogue,
  type ContentCatalogueSource
} from '../contentCatalogue.js'

const SYSTEM = '00000000-0000-4000-8000-0000000000a1'
const VIEWER = '00000000-0000-4000-8000-0000000000b1'
const id = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`

const identity = (suffix: number, label: string) => ({
  id: id(suffix),
  label,
  publicId: label.toLowerCase().replaceAll(' ', '-')
})

const classSource = (sourceKind: 'PLATFORM' | 'USER'): ContentCatalogueSource => ({
  subjectKind: 'CLASS',
  systemId: SYSTEM,
  sourceKind,
  roots:
    sourceKind === 'PLATFORM'
      ? [
          { ...identity(1, 'Wizard'), category: 'BASE' },
          { ...identity(2, 'Evoker'), category: 'SUBCLASS', parentClassId: id(1) },
          { ...identity(3, 'Orphan'), category: 'SUBCLASS', parentClassId: id(99) }
        ]
      : [{ ...identity(4, 'Artificer'), category: 'BASE' }]
})

describe('content catalogue rows', () => {
  it('marks PLATFORM rows MASTER and locked, and the viewer own rows OWNED and editable', () => {
    const items = buildContentCatalogueItems(
      'CLASS',
      [classSource('PLATFORM'), classSource('USER')],
      VIEWER
    )

    expect(items.find((item) => item.label === 'Wizard')).toMatchObject({
      provenance: { kind: 'MASTER', ownerUserId: null },
      permissions: { canView: true, canEdit: false, canCopy: true, canDelete: false }
    })
    expect(items.find((item) => item.label === 'Artificer')).toMatchObject({
      provenance: { kind: 'OWNED', ownerUserId: VIEWER },
      permissions: { canView: true, canEdit: true, canCopy: true, canDelete: true }
    })
  })

  it('resolves a Subclass parent within the System and leaves an unresolved parent off', () => {
    const items = buildContentCatalogueItems('CLASS', [classSource('PLATFORM')], VIEWER)

    expect(items.find((item) => item.label === 'Evoker')).toMatchObject({
      parentClassId: id(1),
      parentClassLabel: 'Wizard'
    })
    expect(items.find((item) => item.label === 'Orphan')).not.toHaveProperty('parentClassId')
  })

  it('reads only the requested kind', () => {
    const items = buildContentCatalogueItems('RACE', [classSource('PLATFORM')], VIEWER)

    expect(items).toEqual([])
  })

  it('orders by lowercase name then id, and groups families under their parent', () => {
    const items = buildContentCatalogueItems(
      'CLASS',
      [classSource('PLATFORM'), classSource('USER')],
      VIEWER
    )

    expect(sortContentCatalogueItems(items, 'name').map((item) => item.label)).toEqual([
      'Artificer',
      'Evoker',
      'Orphan',
      'Wizard'
    ])
    expect(sortContentCatalogueItems(items, 'family').map((item) => item.label)).toEqual([
      'Artificer',
      'Orphan',
      'Wizard',
      'Evoker'
    ])
    expect(sortContentCatalogueItems(items, 'category').map((item) => item.label)).toEqual([
      'Artificer',
      'Wizard',
      'Evoker',
      'Orphan'
    ])
  })
})

describe('content catalogue spells', () => {
  const spells: ContentCatalogueSource = {
    subjectKind: 'SPELL',
    systemId: SYSTEM,
    sourceKind: 'PLATFORM',
    roots: [
      {
        ...identity(10, 'Fire Bolt'),
        level: 0,
        magicSchoolId: id(20),
        magicSchoolLabel: 'Evocation',
        classIds: [id(1), id(99)],
        castingTime: { unit: 'ROUND', amount: 1 }
      },
      {
        ...identity(11, 'Alarm'),
        level: 1,
        magicSchoolId: id(21),
        magicSchoolLabel: 'Abjuration',
        classIds: [id(1)],
        castingTime: { unit: 'MINUTE', amount: 1 }
      }
    ]
  }

  it('labels a Spell only with the visible Classes of its System', () => {
    const items = buildContentCatalogueItems('SPELL', [spells, classSource('PLATFORM')], VIEWER)

    expect(items.find((item) => item.label === 'Fire Bolt')).toMatchObject({
      classIds: [id(1)],
      classLabels: ['Wizard'],
      castingTimeUnit: 'ROUND',
      castingTimeAmount: 1
    })
  })

  it('sorts by level and by school label, then summarizes the facets over every row', () => {
    const items = buildContentCatalogueItems('SPELL', [spells, classSource('PLATFORM')], VIEWER)

    expect(sortContentCatalogueItems(items, 'level').map((item) => item.label)).toEqual([
      'Fire Bolt',
      'Alarm'
    ])
    expect(sortContentCatalogueItems(items, 'school').map((item) => item.label)).toEqual([
      'Alarm',
      'Fire Bolt'
    ])
    expect(summarizeContentCatalogue('SPELL', items)).toEqual({
      activeCount: 2,
      masterCount: 2,
      ownedCount: 0,
      categories: [],
      spellFacets: {
        classes: [{ id: id(1), label: 'Wizard' }],
        schools: [
          { id: id(21), label: 'Abjuration' },
          { id: id(20), label: 'Evocation' }
        ],
        levels: [{ id: 0 }, { id: 1 }]
      }
    })
  })
})

describe('content catalogue summary', () => {
  it('counts by provenance and lists the categories present', () => {
    const items = buildContentCatalogueItems(
      'CLASS',
      [classSource('PLATFORM'), classSource('USER')],
      VIEWER
    )

    expect(summarizeContentCatalogue('CLASS', items)).toEqual({
      activeCount: 4,
      masterCount: 3,
      ownedCount: 1,
      categories: ['BASE', 'SUBCLASS']
    })
  })
})
