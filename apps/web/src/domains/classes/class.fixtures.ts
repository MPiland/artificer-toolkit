import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { ClassListResponseDto, ClassResponseDto } from '@artificer-toolkit/schema/api/content'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  createRuntimeGroupNode as groupNode,
  createRuntimeInputNode as inputNode,
  createRuntimeSelectNode as selectNode
} from '../authoredRouteRuntime.fixtures'

export const ownedClassResponseFixture = {
  publicId: 'class-owned',
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  item: {
    id: 'class-owned',
    label: 'Fighter',
    description: '<p>A master of martial combat.</p>',
    status: 'ACTIVE',
    details: [],
    proficiencies: [],
    features: [],
    userId: 'user-1',
    systemId: SRD_SYSTEM_ID,
    category: 'BASE',
    attributes: [],
    subclassSelectionLevel: 3,
    startingGold: {
      multiplier: 5,
      currencyId: 'gp',
      dieConfig: '1d4'
    },
    startingEquipment: {
      id: 'fighter-starting-equipment',
      sets: []
    },
    hitpoint: {
      dieConfig: '1d10'
    },
    multiclass: {
      id: 'fighter-multiclass',
      requirementGroups: {
        groups: []
      }
    }
  },
  provenance: {
    kind: 'OWNED',
    ownerUserId: 'user-1'
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
} satisfies ClassResponseDto

export const masterSubclassResponseFixture = {
  publicId: 'class-master-subclass',
  activeUpdatedAt: '2026-01-01T00:00:00.000Z',
  hasDraft: false,
  item: {
    id: 'class-master-subclass',
    label: 'Champion',
    description: '<p>A fighter who perfects raw physical prowess.</p>',
    status: 'ACTIVE',
    details: [],
    proficiencies: [],
    features: [],
    userId: 'master',
    systemId: SRD_SYSTEM_ID,
    category: 'SUBCLASS',
    attributes: [],
    parentClassId: 'class-owned',
    specializations: []
  },
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
} satisfies ClassResponseDto

export const classListFixture = {
  items: [
    {
      id: ownedClassResponseFixture.item.id,
      publicId: ownedClassResponseFixture.publicId,
      activeUpdatedAt: ownedClassResponseFixture.activeUpdatedAt,
      label: ownedClassResponseFixture.item.label,
      description: ownedClassResponseFixture.item.description,
      status: 'ACTIVE',
      category: ownedClassResponseFixture.item.category,
      userId: ownedClassResponseFixture.item.userId,
      systemId: ownedClassResponseFixture.item.systemId,
      provenance: ownedClassResponseFixture.provenance,
      permissions: ownedClassResponseFixture.permissions
    },
    {
      id: masterSubclassResponseFixture.item.id,
      publicId: masterSubclassResponseFixture.publicId,
      activeUpdatedAt: masterSubclassResponseFixture.activeUpdatedAt,
      label: masterSubclassResponseFixture.item.label,
      description: masterSubclassResponseFixture.item.description,
      status: 'ACTIVE',
      category: masterSubclassResponseFixture.item.category,
      userId: masterSubclassResponseFixture.item.userId,
      systemId: masterSubclassResponseFixture.item.systemId,
      provenance: masterSubclassResponseFixture.provenance,
      permissions: masterSubclassResponseFixture.permissions
    }
  ],
  drafts: [],
  meta: {},
  page: { nextCursor: null, previousCursor: null, totalCount: 2 },
  summary: { activeCount: 2, masterCount: 1, ownedCount: 1 }
} satisfies ClassListResponseDto

export function createClassRuntimeFixture(
  category?: 'BASE' | 'SUBCLASS'
): NodeRuntimeResolveResponseDto {
  const isSubclass = category === 'SUBCLASS'

  return {
    mapId: 'class',
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
              inputNode('label', ['label'], 'Name', 'TEXT', true),
              inputNode('description', ['description'], 'Description', 'RICH_TEXT'),
              selectNode(
                'category',
                ['category'],
                'Category',
                [
                  { value: 'BASE', label: 'Base Class' },
                  { value: 'SUBCLASS', label: 'Subclass' }
                ],
                true
              ),
              selectNode(
                'parentClassId',
                ['parentClassId'],
                'Parent Class',
                [{ value: 'class-owned', label: 'Fighter' }],
                true,
                isSubclass
              )
            ]
          }
        ]
      },
      {
        id: 'classDetails',
        label: 'Class Details',
        order: 20,
        sections: [
          {
            id: 'classDetails',
            label: 'Class Details',
            order: 10,
            nodes: [
              groupNode('details', ['details'], 'Details', 'ARRAY', 'classDetail'),
              groupNode('features', ['features'], 'Features', 'ARRAY', 'feature')
            ]
          }
        ]
      }
    ]
  }
}

export const classRuntimeFixture = createClassRuntimeFixture('BASE')
