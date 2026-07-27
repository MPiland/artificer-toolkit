import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type {
  EquipmentListResponseDto,
  EquipmentResponseDto
} from '@artificer-toolkit/schema/api/content'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import type { SystemListResponseDto } from '@artificer-toolkit/schema/api/systems'
import { createRuntimeSelectNode as selectNode } from '../authoredRouteRuntime.fixtures'

export const systemListFixture: SystemListResponseDto = [
  {
    id: 'dnd-5e-srd',
    label: 'Dungeons & Dragons 5e SRD',
    description: 'Default system fixture for Equipment authoring stories and tests.',
    rulesetCode: 'dnd5e',
    rulesetVersion: '2014',
    userId: 'master'
  }
]

export const ownedEquipmentFixture: EquipmentAuthoredDto = {
  kind: 'EQUIPMENT',
  id: 'explorers-pack',
  label: 'Explorer Pack',
  description: 'A practical bundle of travel supplies for a new adventurer.',
  quote: 'Everything you need when the road gets muddy.',
  status: 'DRAFT',
  category: 'ADVENTURING_GEAR',
  rarityId: 'common',
  attributes: ['STACKABLE'],
  properties: ['CONTAINER'],
  cost: {
    amount: 10,
    currencyId: 'gp'
  },
  weight: {
    amount: 12,
    unit: 'POUNDS'
  },
  maxStack: 1,
  contains: [
    {
      equipmentId: 'torch',
      quantity: 10
    }
  ],
  effects: [],
  modifiers: [],
  features: [
    {
      id: 'explorer-pack-feature',
      label: 'Packed Supplies',
      description: 'Contains basic travel equipment.',
      order: 1
    }
  ],
  userId: 'user-1',
  systemId: 'dnd-5e-srd'
}

export const ownedVariantEquipmentFixture: EquipmentAuthoredDto = {
  kind: 'EQUIPMENT',
  id: 'longsword-plus-one',
  label: 'Longsword +1',
  description: 'A magically sharpened longsword.',
  quote: 'A clean edge, humming faintly.',
  status: 'DRAFT',
  category: 'VARIANT',
  parentEquipmentId: 'longsword',
  rarityId: 'uncommon',
  properties: ['MAGIC'],
  effects: [],
  modifiers: [],
  features: [],
  userId: 'user-1',
  systemId: 'dnd-5e-srd'
}

export const masterEquipmentFixture: EquipmentAuthoredDto = {
  ...ownedEquipmentFixture,
  id: 'backpack',
  label: 'Backpack',
  description: 'A sturdy pack for carrying adventuring gear.',
  status: 'ACTIVE',
  userId: 'master'
}

export const equipmentListResponseFixture: EquipmentListResponseDto = {
  items: [
    {
      id: masterEquipmentFixture.id,
      publicId: masterEquipmentFixture.id,
      activeRevisionId: 'master-equipment-active-revision',
      label: masterEquipmentFixture.label,
      description: masterEquipmentFixture.description,
      status: 'ACTIVE',
      userId: 'master',
      systemId: masterEquipmentFixture.systemId,
      category: masterEquipmentFixture.category,
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
      id: ownedVariantEquipmentFixture.id,
      publicId: ownedVariantEquipmentFixture.id,
      activeRevisionId: 'owned-variant-equipment-active-revision',
      label: ownedVariantEquipmentFixture.label,
      description: ownedVariantEquipmentFixture.description,
      status: 'DRAFT',
      userId: ownedVariantEquipmentFixture.userId,
      systemId: ownedVariantEquipmentFixture.systemId,
      category: ownedVariantEquipmentFixture.category,
      provenance: {
        kind: 'OWNED',
        ownerUserId: ownedVariantEquipmentFixture.userId
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
  meta: {}
}

export const ownedEquipmentResponseFixture: NonNullable<EquipmentResponseDto> = {
  publicId: ownedEquipmentFixture.id,
  activeRevisionId: 'owned-equipment-active-revision',
  hasDraft: false,
  item: ownedEquipmentFixture,
  provenance: {
    kind: 'OWNED',
    ownerUserId: ownedEquipmentFixture.userId
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
}

export const ownedVariantEquipmentResponseFixture: NonNullable<EquipmentResponseDto> = {
  publicId: ownedVariantEquipmentFixture.id,
  activeRevisionId: 'owned-variant-equipment-active-revision',
  hasDraft: false,
  item: ownedVariantEquipmentFixture,
  provenance: {
    kind: 'OWNED',
    ownerUserId: ownedVariantEquipmentFixture.userId
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
}

export const masterEquipmentResponseFixture: NonNullable<EquipmentResponseDto> = {
  publicId: masterEquipmentFixture.id,
  activeRevisionId: 'master-equipment-active-revision',
  hasDraft: false,
  item: masterEquipmentFixture,
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

export const equipmentRuntimeFixture: NodeRuntimeResolveResponseDto = {
  mapId: 'equipment',
  clearPaths: [],
  scopes: [],
  steps: [
    {
      id: 'properties',
      label: 'Properties',
      order: 20,
      sections: [
        {
          id: 'properties',
          label: 'Properties',
          order: 20,
          nodes: [
            selectNode(
              'category',
              ['category'],
              'Category',
              [
                { value: 'WEAPON', label: 'Weapon' },
                { value: 'ARMOR', label: 'Armor' },
                { value: 'ADVENTURING_GEAR', label: 'Adventuring Gear' },
                { value: 'TOOL', label: 'Tool' },
                { value: 'SHIELD', label: 'Shield' },
                { value: 'VARIANT', label: 'Variant' }
              ],
              true
            ),
            selectNode(
              'attributes',
              ['attributes'],
              'Attributes',
              [
                { value: 'LIMITED_USE', label: 'Limited Use' },
                { value: 'STACKABLE', label: 'Stackable' }
              ],
              false,
              'SELECT_MULTI'
            ),
            selectNode(
              'rarityId',
              ['rarityId'],
              'Rarity',
              [
                { value: 'common', label: 'Common' },
                { value: 'uncommon', label: 'Uncommon' }
              ],
              true
            ),
            selectNode(
              'parentEquipmentId',
              ['parentEquipmentId'],
              'Parent Equipment',
              [
                { value: 'longsword', label: 'Longsword' },
                { value: 'backpack', label: 'Backpack' }
              ],
              true
            ),
            selectNode(
              'properties',
              ['properties'],
              'Properties',
              [
                { value: 'CONTAINER', label: 'Container' },
                { value: 'MAGIC', label: 'Magic' }
              ],
              false,
              'SELECT_MULTI'
            )
          ]
        }
      ]
    },
    {
      id: 'economy',
      label: 'Cost and Weight',
      order: 30,
      sections: [
        {
          id: 'economy',
          label: 'Cost and Weight',
          order: 30,
          nodes: [
            selectNode(
              'currencyId',
              ['cost', 'currencyId'],
              'Currency',
              [
                { value: 'gp', label: 'Gold' },
                { value: 'sp', label: 'Silver' }
              ],
              false
            ),
            selectNode(
              'unit',
              ['weight', 'unit'],
              'Unit',
              [
                { value: 'POUNDS', label: 'Pounds' },
                { value: 'GALLONS', label: 'Gallons' }
              ],
              true
            )
          ]
        }
      ]
    },
    {
      id: 'contents',
      label: 'Contents',
      order: 50,
      sections: [
        {
          id: 'contents',
          label: 'Contents',
          order: 50,
          nodes: [
            selectNode(
              'equipmentId',
              ['contains', 'equipmentId'],
              'Equipment',
              [
                { value: 'torch', label: 'Torch' },
                { value: 'rations', label: 'Rations' }
              ],
              true
            )
          ]
        }
      ]
    }
  ]
}
