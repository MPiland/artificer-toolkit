import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import type { RaceAuthoredDto } from '@artificer-toolkit/schema/subjects/race'
import type { RaceListResponseDto, RaceResponseDto } from '@artificer-toolkit/schema/api/content'
import { createRuntimeSelectNode as selectNode } from '../authoredRouteRuntime.fixtures'

export const ownedBaseRaceFixture: RaceAuthoredDto = {
  id: 'dragonborn',
  label: 'Dragonborn',
  quote: 'Proud dragonkin shaped by clan and ancestry.',
  description:
    'Dragonborn bear draconic heritage that determines their breath weapon and damage resistance.',
  status: 'DRAFT',
  category: 'BASE',
  selectionMode: 'DIRECT',
  heritageIds: ['draconic'],
  size: 'MEDIUM',
  speeds: [
    {
      speedId: 'walk',
      amount: 30,
      unit: 'FEET'
    }
  ],
  ancestry: {
    id: 'draconic-ancestry',
    label: 'Draconic Ancestry',
    description: 'Choose one dragon type.',
    options: [
      {
        id: 'red-dragon',
        label: 'Red',
        description: 'Fire damage and fire resistance.',
        order: 1,
        features: []
      }
    ]
  },
  details: [
    {
      id: 'dragonborn-lore',
      label: 'Lore Note',
      description: 'Dragonborn clans carry the memory of ancient dragons.',
      order: 1
    }
  ],
  features: [
    {
      id: 'dragonborn-breath',
      label: 'Breath Weapon',
      description: 'Exhale destructive energy tied to your draconic ancestry.',
      order: 1
    }
  ],
  userId: 'user-1',
  systemId: 'dnd-5e-srd'
}

export const ownedSubraceFixture: RaceAuthoredDto = {
  id: 'wood-elf',
  label: 'Wood Elf',
  quote: 'Quiet steps beneath old branches.',
  description: 'Wood elves are swift, quiet, and deeply attuned to life in ancient forests.',
  status: 'DRAFT',
  category: 'SUBRACE',
  parentRaceId: 'elf',
  details: [
    {
      id: 'wood-elf-lore',
      label: 'Lore Note',
      description: 'Wood elves preserve old paths through sacred groves.',
      order: 1
    }
  ],
  features: [
    {
      id: 'fleet-of-foot',
      label: 'Fleet of Foot',
      description: 'Your base walking speed increases by 5 feet.',
      order: 1
    }
  ],
  userId: 'user-1',
  systemId: 'dnd-5e-srd'
}

export const masterRaceFixture: RaceAuthoredDto = {
  ...ownedBaseRaceFixture,
  id: 'elf',
  label: 'Elf',
  description: 'Elves are magical people of otherworldly grace.',
  status: 'ACTIVE',
  userId: 'master'
}

export const raceListResponseFixture: RaceListResponseDto = {
  items: [
    {
      id: masterRaceFixture.id,
      publicId: masterRaceFixture.id,
      activeUpdatedAt: '2026-01-01T00:00:00.000Z',
      label: masterRaceFixture.label,
      description: masterRaceFixture.description,
      status: 'ACTIVE',
      userId: 'master',
      systemId: masterRaceFixture.systemId,
      category: masterRaceFixture.category,
      provenance: {
        kind: 'MASTER',
        ownerUserId: null
      },
      permissions: {
        canView: true,
        canEdit: false,
        canCopy: true,
        canDelete: false
      }
    },
    {
      id: ownedSubraceFixture.id,
      publicId: ownedSubraceFixture.id,
      activeUpdatedAt: '2026-01-01T00:00:00.000Z',
      label: ownedSubraceFixture.label,
      description: ownedSubraceFixture.description,
      status: 'DRAFT',
      userId: ownedSubraceFixture.userId,
      systemId: ownedSubraceFixture.systemId,
      category: ownedSubraceFixture.category,
      provenance: {
        kind: 'OWNED',
        ownerUserId: ownedSubraceFixture.userId
      },
      permissions: {
        canView: true,
        canEdit: true,
        canCopy: true,
        canDelete: true
      }
    }
  ],
  drafts: [],
  meta: {},
  page: { nextCursor: null, previousCursor: null, totalCount: 3 },
  summary: { activeCount: 3, masterCount: 2, ownedCount: 1 }
}

export const ownedBaseRaceResponseFixture: NonNullable<RaceResponseDto> = {
  publicId: ownedBaseRaceFixture.id,
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  item: ownedBaseRaceFixture,
  provenance: {
    kind: 'OWNED',
    ownerUserId: ownedBaseRaceFixture.userId
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
}

export const ownedSubraceResponseFixture: NonNullable<RaceResponseDto> = {
  publicId: ownedSubraceFixture.id,
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  item: ownedSubraceFixture,
  provenance: {
    kind: 'OWNED',
    ownerUserId: ownedSubraceFixture.userId
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
}

export const masterRaceResponseFixture: NonNullable<RaceResponseDto> = {
  publicId: masterRaceFixture.id,
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  item: masterRaceFixture,
  provenance: {
    kind: 'MASTER',
    ownerUserId: null
  },
  permissions: {
    canView: true,
    canEdit: false,
    canCopy: true,
    canDelete: false
  }
}

export const raceRuntimeFixture: NodeRuntimeResolveResponseDto = {
  mapId: 'race',
  clearPaths: [],
  scopes: [],
  steps: [
    {
      id: 'basics',
      label: 'Basics',
      order: 10,
      sections: [
        {
          id: 'basics',
          label: 'Basics',
          order: 10,
          nodes: [
            selectNode(
              'category',
              ['category'],
              'Category',
              [
                { value: 'BASE', label: 'Base Race' },
                { value: 'SUBRACE', label: 'Subrace' }
              ],
              true
            ),
            selectNode(
              'selectionMode',
              ['selectionMode'],
              'Selection Mode',
              [
                { value: 'DIRECT', label: 'Direct' },
                { value: 'REQUIRES_SUBRACE', label: 'Requires Subrace' }
              ],
              true
            ),
            selectNode(
              'heritageIds',
              ['heritageIds'],
              'Heritages',
              [
                { value: 'draconic', label: 'Draconic' },
                { value: 'elven', label: 'Elven' }
              ],
              false,
              'SELECT_MULTI'
            ),
            selectNode(
              'parentRaceId',
              ['parentRaceId'],
              'Parent Race',
              [
                { value: 'elf', label: 'Elf' },
                { value: 'dragonborn', label: 'Dragonborn' }
              ],
              true
            )
          ]
        }
      ]
    },
    {
      id: 'traits',
      label: 'Traits',
      order: 40,
      sections: [
        {
          id: 'traits',
          label: 'Traits',
          order: 40,
          nodes: [
            selectNode(
              'size',
              ['size'],
              'Size',
              [
                { value: 'SMALL', label: 'Small' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'LARGE', label: 'Large' }
              ],
              true
            )
          ]
        }
      ]
    }
  ]
}
