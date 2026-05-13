import type {
  ClassListResponseDto,
  ClassResponseDto
} from '@artificer-toolkit/schema/api/content'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'

export const ownedClassResponseFixture = {
  publicId: 'class-owned',
  item: {
    id: 'class-owned',
    label: 'Fighter',
    description: '<p>A master of martial combat.</p>',
    status: 'ACTIVE',
    details: [],
    proficiencies: [],
    features: [],
    userId: 'user-1',
    systemId: 'system-5e',
    category: 'BASE',
    attributes: [],
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
      ability: 'CONSTITUTION',
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
  item: {
    id: 'class-master-subclass',
    label: 'Champion',
    description: '<p>A fighter who perfects raw physical prowess.</p>',
    status: 'ACTIVE',
    details: [],
    proficiencies: [],
    features: [],
    userId: 'master',
    systemId: 'system-5e',
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
  meta: {}
} satisfies ClassListResponseDto

export function createClassRuntimeFixture(
  category?: 'BASE' | 'SUBCLASS'
): NodeRuntimeResolveResponseDto {
  const isSubclass = category === 'SUBCLASS'

  return {
    mapId: 'class',
    clearPaths: [],
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
              selectNode('category', ['category'], 'Category', [
                { value: 'BASE', label: 'Base Class' },
                { value: 'SUBCLASS', label: 'Subclass' }
              ], true),
              selectNode('parentClassId', ['parentClassId'], 'Parent Class', [{ value: 'class-owned', label: 'Fighter' }], true, isSubclass)
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

function inputNode(
  id: string,
  path: string[],
  label: string,
  type: 'TEXT' | 'NUMBER' | 'RICH_TEXT',
  required = false
): NodeRuntimeResolveResponseDto['steps'][number]['sections'][number]['nodes'][number] {
  return {
    id,
    path,
    label,
    kind: 'INPUT',
    type,
    visible: true,
    required,
    clearPaths: []
  }
}

function selectNode(
  id: string,
  path: string[],
  label: string,
  options: NonNullable<NodeRuntimeResolveResponseDto['steps'][number]['sections'][number]['nodes'][number]['options']>,
  required = false,
  visible = true
): NodeRuntimeResolveResponseDto['steps'][number]['sections'][number]['nodes'][number] {
  return {
    id,
    path,
    label,
    kind: 'INPUT',
    type: 'SELECT_SINGLE',
    visible,
    required,
    clearPaths: [],
    options
  }
}

function groupNode(
  id: string,
  path: string[],
  label: string,
  groupKind: 'OBJECT' | 'ARRAY',
  childMapId: string
): NodeRuntimeResolveResponseDto['steps'][number]['sections'][number]['nodes'][number] {
  return {
    id,
    path,
    label,
    kind: 'GROUP',
    groupKind,
    childMapId,
    visible: true,
    required: false,
    clearPaths: []
  }
}
