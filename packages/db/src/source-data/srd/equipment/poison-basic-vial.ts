import type { EquipmentAuthored, ManifestBehaviorAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

const poisonedHitBehavior = (bucket: number): ManifestBehaviorAuthored => ({
  id: S.equipmentChildId(S.equipId(364), bucket, 1),
  order: 1,
  invocation: {
    kind: 'PASSIVE',
    triggerCode: S.TRIGGER.SAVING_THROW,
    savingThrow: {
      id: S.equipmentChildId(S.equipId(364), bucket + 1, 1),
      dcMethod: 'FIXED_DC',
      ability: S.ABILITY_CODE.CONSTITUTION,
      baseDc: 10
    },
    range: {
      id: S.equipmentChildId(S.equipId(364), bucket + 2, 1),
      rangeKind: S.RANGE_KIND.SELF
    }
  },
  paths: [
    {
      id: S.equipmentChildId(S.equipId(364), bucket + 3, 1),
      order: 1,
      pathCode: S.PATH_CODE.ON_SAVE_FAIL,
      groupType: S.PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: `${S.equipmentChildId(S.equipId(364), bucket + 3, 1)}__result`,
        resultKind: 'SINGLE',
        outcomes: [
          {
            id: S.equipmentChildId(S.equipId(364), bucket + 4, 1),
            effectKind: S.EFFECT_KIND.DAMAGE,
            damageTypeId: S.damageTypeId('POISON'),
            valueKind: S.DAMAGE_VALUE_KIND.DICE,
            scalingKind: S.SCALING.NONE,
            diceConfig: '1d4'
          }
        ]
      }
    }
  ]
})

export const poisonBasicVial: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(364),
  label: 'Poison, Basic (vial)',
  description:
    'You can use the poison in this vial to coat one slashing or piercing weapon or up to three pieces of ammunition. Applying the poison takes an action. A creature hit by the poisoned weapon or ammunition must make a DC 10 Constitution saving throw or take 1d4 poison damage. Once applied, the poison retains potency for 1 minute before drying.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.VIAL, S.EQUIPMENT_PROPERTY_CODE.POISON],
  effects: [
    {
      id: S.equipmentChildId(S.equipId(364), 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(364), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(364), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_USE,
          groupType: S.PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE' as const,
          selectionKind: 'CHOICE' as const,
          options: [
            {
              id: S.equipmentChildId(S.equipId(364), 0x212, 1),
              order: 1,
              label: 'Coat one weapon',
              description:
                'You can use the poison in this vial to coat one slashing or piercing weapon or up to three pieces of ammunition.',
              resultBlock: {
                id: `${S.equipmentChildId(S.equipId(364), 0x212, 1)}__result`,
                resultKind: 'SINGLE' as const,
                duration: {
                  id: S.equipmentChildId(S.equipId(364), 0x213, 1),
                  durationKind: S.DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.equipmentChildId(S.equipId(364), 0x214, 1),
                    effectKind: S.EFFECT_KIND.MANIFEST,
                    manifestKind: 'OBJECT' as const,
                    attachmentKind: 'TOUCHED_OBJECT' as const,
                    label: 'Poisoned weapon',
                    applicationTargetKind: 'WEAPON' as const,
                    applicationCount: 1,
                    qualifyingDamageTypeIds: [
                      S.damageTypeId('SLASHING'),
                      S.damageTypeId('PIERCING')
                    ],
                    components: [
                      {
                        id: S.equipmentChildId(S.equipId(364), 0x215, 1),
                        order: 1,
                        label: 'Poisoned hit',
                        interactionKind: 'SOURCE_HIT' as const,
                        behaviors: [poisonedHitBehavior(0x220)]
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: S.equipmentChildId(S.equipId(364), 0x212, 2),
              order: 2,
              label: 'Coat up to three pieces of ammunition',
              description:
                'You can use the poison in this vial to coat one slashing or piercing weapon or up to three pieces of ammunition.',
              resultBlock: {
                id: `${S.equipmentChildId(S.equipId(364), 0x212, 2)}__result`,
                resultKind: 'SINGLE' as const,
                duration: {
                  id: S.equipmentChildId(S.equipId(364), 0x213, 2),
                  durationKind: S.DURATION_KIND.MINUTE,
                  amount: 1
                },
                outcomes: [
                  {
                    id: S.equipmentChildId(S.equipId(364), 0x214, 2),
                    effectKind: S.EFFECT_KIND.MANIFEST,
                    manifestKind: 'OBJECT' as const,
                    attachmentKind: 'TOUCHED_OBJECT' as const,
                    label: 'Poisoned ammunition',
                    applicationTargetKind: 'AMMUNITION' as const,
                    applicationCount: 3,
                    qualifyingDamageTypeIds: [
                      S.damageTypeId('SLASHING'),
                      S.damageTypeId('PIERCING')
                    ],
                    components: [
                      {
                        id: S.equipmentChildId(S.equipId(364), 0x215, 2),
                        order: 1,
                        label: 'Poisoned hit',
                        interactionKind: 'SOURCE_HIT' as const,
                        behaviors: [poisonedHitBehavior(0x230)]
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ],
  cost: S.gp(100),
  weight: S.lbs(0),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
