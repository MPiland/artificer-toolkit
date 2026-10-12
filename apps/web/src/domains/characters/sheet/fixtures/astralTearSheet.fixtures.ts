import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'

import { characterSheetFixture } from './characterSheet.fixtures'

export const astralTearEquipmentId = '00000000-0000-0000-0060-0a5700000000'
export const astralTearItemInstanceId = '00000000-0000-4000-8000-000000000601'
export const astralTearChargeId = 'astral-tear-charges'
export const astralTearResourceId = `item:${astralTearItemInstanceId}:charge:${astralTearChargeId}`

const astralTearDescription =
  '<p>This mighty blade belongs to the Astral Champion of Vedur. While attuned to it, its wielder can call it to hand from a special demiplane.</p>'

const warpingStrikeDescription =
  '<p>While holding the sword, you can expend 1 of its charges as part of making an attack with it. You can teleport to an unoccupied space you can see within 30 feet either before or after the attack. On a hit, the target also takes 4d6 force damage.</p>'

const spellsDescription =
  '<p>While holding the sword, you can use an action to expend 1 of its charges to cast a 2nd-level or lower spell without expending a spell slot.</p>'

export const astralTearCharacterSheetFixture = {
  ...characterSheetFixture,
  actions: {
    items: [
      {
        id: `${astralTearItemInstanceId}:feature:warping-strike`,
        label: 'Warping Strike',
        kind: 'OTHER',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'The Astral Tear Awakened',
        description: warpingStrikeDescription,
        resourceGrantId: astralTearResourceId,
        resourceCost: 1
      },
      {
        id: `${astralTearItemInstanceId}:feature:spells`,
        label: 'Spells',
        kind: 'ACTION',
        availability: { status: 'AVAILABLE' },
        sourceLabel: 'The Astral Tear Awakened',
        description: spellsDescription,
        resourceGrantId: astralTearResourceId,
        resourceCost: 1
      },
      ...characterSheetFixture.actions.items
    ]
  },
  resources: {
    ...characterSheetFixture.resources,
    items: [
      {
        id: astralTearResourceId,
        label: 'The Astral Tear Awakened charges',
        description: '<p>Both item features draw from this owned blade\u2019s shared pool.</p>',
        sourceLabel: 'The Astral Tear Awakened',
        owner: {
          kind: 'ITEM_INSTANCE',
          chargeId: astralTearChargeId,
          itemInstanceId: astralTearItemInstanceId
        },
        used: 1,
        max: 3,
        remaining: 2,
        recoveries: [{ trigger: 'DAWN', amount: { kind: 'ALL' } }]
      },
      ...characterSheetFixture.resources.items
    ]
  },
  inventory: {
    ...characterSheetFixture.inventory,
    items: [
      {
        id: astralTearItemInstanceId,
        equipmentId: astralTearEquipmentId,
        label: 'The Astral Tear Awakened',
        description: astralTearDescription,
        category: 'WEAPON',
        properties: [
          { code: 'FINESSE', label: 'Finesse' },
          { code: 'LIGHT', label: 'Light' },
          { code: 'VEX', label: 'Vex' }
        ],
        cost: { amount: 2000, currencyId: 'gp' },
        costLabel: 'gold pieces',
        weight: { amount: 2, unit: 'POUNDS' },
        quantity: 1,
        equippedSlot: 'MAIN_HAND',
        attuned: true,
        requiresAttunement: true
      },
      ...characterSheetFixture.inventory.items
    ]
  },
  reference: {
    ...characterSheetFixture.reference,
    features: [
      {
        id: `astral-tear-warping-strike:${astralTearItemInstanceId}`,
        label: 'Warping Strike',
        description: warpingStrikeDescription,
        sourceLabel: 'The Astral Tear Awakened',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: astralTearEquipmentId,
          itemInstanceId: astralTearItemInstanceId
        },
        resourceGrantId: astralTearResourceId,
        resourceCost: 1
      },
      {
        id: `astral-tear-spells:${astralTearItemInstanceId}`,
        label: 'Spells',
        description: spellsDescription,
        sourceLabel: 'The Astral Tear Awakened',
        source: {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: astralTearEquipmentId,
          itemInstanceId: astralTearItemInstanceId
        },
        resourceGrantId: astralTearResourceId,
        resourceCost: 1
      },
      ...characterSheetFixture.reference.features
    ],
    equipmentOptions: [
      {
        id: astralTearEquipmentId,
        label: 'The Astral Tear Awakened',
        isContainer: false,
        requiresAttunement: true
      },
      ...characterSheetFixture.reference.equipmentOptions
    ]
  }
} satisfies CharacterSheetResponseDto
