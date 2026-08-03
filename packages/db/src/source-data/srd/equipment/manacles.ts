import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'
export const manacles: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(153),
  label: 'Manacles',
  description:
    "These metal restraints can bind a Small or Medium creature. Escaping the manacles requires a successful DC 20 Dexterity check. Breaking them requires a successful DC 20 Strength check. Each set of manacles comes with one key. Without the key, a creature proficient with thieves' tools can pick the manacles' lock with a successful DC 15 Dexterity check. Manacles have 15 hit points.",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  effects: [
    {
      id: S.equipmentChildId(S.equipId(153), 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: S.TRIGGER.ACTIVATED,
        activation: {
          code: S.ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: S.equipmentChildId(S.equipId(153), 0x211, 1),
          rangeKind: S.RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: S.TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: S.TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: S.equipmentChildId(S.equipId(153), 0x212, 1),
          order: 1,
          pathCode: S.PATH_CODE.ON_USE,
          groupType: S.PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: S.equipmentChildId(S.equipId(153), 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: S.equipmentChildId(S.equipId(153), 0x212, 1),
                effectKind: S.EFFECT_KIND.MANIFEST,
                manifestKind: 'OBJECT' as const,
                attachmentKind: 'PRIMARY_TARGET' as const,
                label: 'Bound by manacles',
                maximumTargetSize: 'MEDIUM' as const,
                components: [
                  {
                    id: S.equipmentChildId(S.equipId(153), 0x220, 1),
                    order: 1,
                    label: 'Manacles',
                    hitPoints: 15,
                    releaseCriteria: [
                      {
                        id: S.equipmentChildId(S.equipId(153), 0x221, 1),
                        order: 1,
                        kind: 'NAMED_OBJECT' as const,
                        objectLabel: 'Provided manacles key'
                      }
                    ]
                  }
                ]
              },
              {
                id: S.equipmentChildId(S.equipId(153), 0x222, 1),
                effectKind: S.EFFECT_KIND.FOLLOW_UP_CHECK,
                label: 'Escape the manacles',
                activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                ability: S.ABILITY_CODE.DEXTERITY,
                fixedDc: 20,
                actorKinds: ['TARGET'],
                repeatable: true,
                onSuccess: { kind: 'END' as const },
                onFailure: { kind: 'CONTINUE' as const }
              },
              {
                id: S.equipmentChildId(S.equipId(153), 0x223, 1),
                effectKind: S.EFFECT_KIND.FOLLOW_UP_CHECK,
                label: 'Break the manacles',
                activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                ability: S.ABILITY_CODE.STRENGTH,
                fixedDc: 20,
                actorKinds: ['TARGET', 'CREATURE_WITHIN_REACH'],
                repeatable: true,
                onSuccess: { kind: 'END' as const },
                onFailure: { kind: 'CONTINUE' as const }
              },
              {
                id: S.equipmentChildId(S.equipId(153), 0x224, 1),
                effectKind: S.EFFECT_KIND.FOLLOW_UP_CHECK,
                label: "Pick the manacles' lock",
                activation: { code: S.ACTIVATION_CODE.ACTION, amount: 1 },
                ability: S.ABILITY_CODE.DEXTERITY,
                fixedDc: 15,
                toolEquipmentId: S.equipId(85),
                actorKinds: ['TARGET', 'CREATURE_WITHIN_REACH'],
                repeatable: true,
                onSuccess: { kind: 'END' as const },
                onFailure: { kind: 'CONTINUE' as const }
              }
            ]
          }
        }
      ]
    }
  ],
  cost: S.gp(2),
  weight: S.lbs(6),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
