import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import type {
  VehicleListResponseDto,
  VehicleResponseDto
} from '@artificer-toolkit/schema/api/content'
import {
  createRuntimeGroupNode as groupNode,
  createRuntimeInputNode as inputNode,
  createRuntimeSelectNode as selectNode
} from '../authoredRouteRuntime.fixtures'

export const ownedVehicleResponseFixture = {
  publicId: 'vehicle-owned',
  activeRevisionId: 'vehicle-owned-active-revision',
  item: {
    id: 'vehicle-owned',
    label: 'Sky Skiff',
    description: '<p>A nimble air vehicle.</p>',
    status: 'ACTIVE',
    details: [
      {
        id: 'vehicle-detail-1',
        label: 'Handling',
        description: '<p>Responsive and light.</p>',
        order: 1
      }
    ],
    userId: 'user-1',
    systemId: 'system-5e',
    category: 'AIR',
    size: 'LARGE',
    armorClass: 15,
    hitPoints: 80,
    speed: 60,
    speedNote: 'fly',
    crewMin: 1,
    crewMax: 4,
    passengerCapacity: 6,
    cargoCapacity: '500 lb.',
    cost: {
      amount: 5000,
      currencyId: 'gp'
    },
    properties: ['fast'],
    features: [
      {
        id: 'vehicle-feature-1',
        label: 'Glide',
        description: '<p>Can descend safely when damaged.</p>',
        order: 1
      }
    ]
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
} satisfies VehicleResponseDto

export const masterVehicleResponseFixture = {
  publicId: 'vehicle-master',
  activeRevisionId: 'vehicle-master-active-revision',
  item: {
    id: 'vehicle-master',
    label: 'Galley',
    description: '<p>A large oared ship.</p>',
    status: 'ACTIVE',
    userId: 'master',
    systemId: 'system-5e',
    category: 'WATER',
    size: 'GARGANTUAN',
    armorClass: 15,
    hitPoints: 500,
    speed: 4,
    properties: []
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
} satisfies VehicleResponseDto

export const vehicleListFixture = {
  items: [
    {
      id: ownedVehicleResponseFixture.item.id,
      publicId: ownedVehicleResponseFixture.publicId,
      activeRevisionId: ownedVehicleResponseFixture.activeRevisionId,
      label: ownedVehicleResponseFixture.item.label,
      description: ownedVehicleResponseFixture.item.description,
      status: 'ACTIVE',
      category: ownedVehicleResponseFixture.item.category,
      userId: ownedVehicleResponseFixture.item.userId,
      systemId: ownedVehicleResponseFixture.item.systemId,
      provenance: ownedVehicleResponseFixture.provenance,
      permissions: ownedVehicleResponseFixture.permissions
    },
    {
      id: masterVehicleResponseFixture.item.id,
      publicId: masterVehicleResponseFixture.publicId,
      activeRevisionId: masterVehicleResponseFixture.activeRevisionId,
      label: masterVehicleResponseFixture.item.label,
      description: masterVehicleResponseFixture.item.description,
      status: 'ACTIVE',
      category: masterVehicleResponseFixture.item.category,
      userId: masterVehicleResponseFixture.item.userId,
      systemId: masterVehicleResponseFixture.item.systemId,
      provenance: masterVehicleResponseFixture.provenance,
      permissions: masterVehicleResponseFixture.permissions
    }
  ],
  drafts: [],
  meta: {}
} satisfies VehicleListResponseDto

export const vehicleRuntimeFixture = {
  mapId: 'vehicle',
  clearPaths: [],
  scopes: [],
  steps: [
    {
      id: 'overview',
      label: 'Overview',
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
              { value: 'LAND', label: 'Land' },
              { value: 'WATER', label: 'Water' },
              { value: 'AIR', label: 'Air' },
              { value: 'SPELLJAMMER', label: 'Spelljammer' }
            ], true)
          ]
        }
      ]
    },
    {
      id: 'stats',
      label: 'Stats',
      order: 20,
      sections: [
        {
          id: 'stats',
          label: 'Stats',
          order: 10,
          nodes: [
            selectNode('size', ['size'], 'Size', [
              { value: 'LARGE', label: 'Large' },
              { value: 'GARGANTUAN', label: 'Gargantuan' }
            ]),
            inputNode('armorClass', ['armorClass'], 'Armor Class', 'NUMBER'),
            inputNode('hitPoints', ['hitPoints'], 'Hit Points', 'NUMBER')
          ]
        }
      ]
    },
    {
      id: 'capacity',
      label: 'Crew and Capacity',
      order: 30,
      sections: [
        {
          id: 'capacity',
          label: 'Capacity',
          order: 10,
          nodes: [
            inputNode('crewMin', ['crewMin'], 'Minimum Crew', 'NUMBER'),
            inputNode('crewMax', ['crewMax'], 'Maximum Crew', 'NUMBER'),
            inputNode('passengerCapacity', ['passengerCapacity'], 'Passenger Capacity', 'NUMBER'),
            inputNode('cargoCapacity', ['cargoCapacity'], 'Cargo Capacity', 'TEXT')
          ]
        }
      ]
    },
    {
      id: 'economy',
      label: 'Cost and Properties',
      order: 40,
      sections: [
        {
          id: 'economy',
          label: 'Cost and Properties',
          order: 10,
          nodes: [
            groupNode('cost', ['cost'], 'Cost', 'OBJECT', 'cost'),
            groupNode('properties', ['properties'], 'Properties', 'ARRAY', 'vehicleString')
          ]
        }
      ]
    },
    {
      id: 'content',
      label: 'Features and Details',
      order: 50,
      sections: [
        {
          id: 'content',
          label: 'Features and Details',
          order: 10,
          nodes: [
            groupNode('features', ['features'], 'Features', 'ARRAY', 'feature'),
            groupNode('details', ['details'], 'Details', 'ARRAY', 'vehicleDetail')
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto
