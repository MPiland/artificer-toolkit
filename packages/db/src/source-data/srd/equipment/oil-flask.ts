import type { EquipmentAuthored, ManifestBehaviorAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

const fireDamageBehavior = (bucket: number): ManifestBehaviorAuthored => ({
  id: S.equipmentChildId(S.equipId(157), bucket, 1),
  order: 1,
  invocation: {
    kind: 'PASSIVE',
    triggerCode: S.TRIGGER.ACTIVATED,
    range: {
      id: S.equipmentChildId(S.equipId(157), bucket + 1, 1),
      rangeKind: S.RANGE_KIND.SELF
    }
  },
  paths: [
    {
      id: S.equipmentChildId(S.equipId(157), bucket + 2, 1),
      order: 1,
      pathCode: S.PATH_CODE.ON_USE,
      groupType: S.PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: `${S.equipmentChildId(S.equipId(157), bucket + 2, 1)}__result`,
        resultKind: 'SINGLE',
        outcomes: [
          {
            id: S.equipmentChildId(S.equipId(157), bucket + 3, 1),
            effectKind: S.EFFECT_KIND.DAMAGE,
            damageTypeId: S.damageTypeId('FIRE'),
            valueKind: S.DAMAGE_VALUE_KIND.FIXED,
            scalingKind: S.SCALING.NONE,
            amount: 5
          }
        ]
      }
    }
  ]
})

export const oilFlask: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(157),
  label: 'Oil (flask)',
  description: "Oil usually comes in a clay flask that holds 1 pint. As an action, you can splash the oil in this flask onto a creature within 5 feet of you or throw it up to 20 feet, shattering it on impact. Make a ranged attack against a target creature or object, treating the oil as an improvised weapon. On a hit, the target is covered in oil. If the target takes any fire damage before the oil dries (after 1 minute), the target takes an additional 5 fire damage from the burning oil. You can also pour a flask of oil on the ground to cover a 5-foot-square area, provided that the surface is level. If lit, the oil burns for 2 rounds and deals 5 fire damage to any creature that enters the area or ends its turn in the area. A creature can take this damage only once per turn.",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.FLASK],
  effects: [
    {
      id: S.equipmentChildId(S.equipId(157), 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: S.TRIGGER.RANGED_WEAPON_ATTACK,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(157), 0x211, 1),
          rangeKind: S.RANGE_KIND.DISTANCE,
          amount: 20,
          unit: S.MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(157), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_HIT,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: S.equipmentChildId(S.equipId(157), 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: S.equipmentChildId(S.equipId(157), 0x213, 1),
              durationKind: S.DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(157), 0x212, 1),
                effectKind: S.EFFECT_KIND.MANIFEST,
                manifestKind: 'OBJECT' as const,
                attachmentKind: 'PRIMARY_TARGET' as const,
                label: 'Oil coating',
                components: [
                  {
                    id: S.equipmentChildId(S.equipId(157), 0x214, 1),
                    order: 1,
                    label: 'Ignite the coating',
                    interactionKind: 'TARGET_TAKES_FIRE_DAMAGE' as const,
                    maxApplicationsTotal: 1,
                    behaviors: [fireDamageBehavior(0x215)]
                  }
                ]
              }
            ]
          }
        },
      ]
    },
    {
      id: S.equipmentChildId(S.equipId(157), 0x230, 1),
      order: 2,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: S.equipmentChildId(S.equipId(157), 0x231, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(157), 0x232, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_USE,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: `${S.equipmentChildId(S.equipId(157), 0x232, 1)}__result`,
            resultKind: 'SINGLE' as const,
            duration: {
              id: S.equipmentChildId(S.equipId(157), 0x233, 1),
              durationKind: S.DURATION_KIND.ROUND,
              amount: 2
            },
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(157), 0x234, 1),
                effectKind: S.EFFECT_KIND.MANIFEST,
                manifestKind: 'ZONE' as const,
                attachmentKind: 'PLACED_SPACE' as const,
                label: 'Poured oil',
                placementSurfaceKind: 'LEVEL' as const,
                maxApplicationsPerTurn: 1,
                shape: {
                  id: S.equipmentChildId(S.equipId(157), 0x235, 1),
                  shapeKind: S.SHAPE_KIND.CUBE,
                  edgeLength: { amount: 5, unit: S.MEASUREMENT_UNIT_CODE.FEET }
                },
                components: [
                  {
                    id: S.equipmentChildId(S.equipId(157), 0x236, 1),
                    order: 1,
                    label: 'Enter burning oil',
                    interactionKind: 'ENTER_SPACE' as const,
                    requiresIgnition: true,
                    behaviors: [fireDamageBehavior(0x240)]
                  },
                  {
                    id: S.equipmentChildId(S.equipId(157), 0x236, 2),
                    order: 2,
                    label: 'End turn in burning oil',
                    interactionKind: 'END_TURN_IN_SPACE' as const,
                    requiresIgnition: true,
                    behaviors: [fireDamageBehavior(0x250)]
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  ],
  cost: S.sp(1),
  weight: S.lbs(1),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
