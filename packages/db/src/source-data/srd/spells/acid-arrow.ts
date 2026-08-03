import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SPELL_COMPONENT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  SUBJECT,
  TRIGGER,
  type DamageAuthored,
  type ManifestBehaviorAuthored,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const acidDamage = (bucket: number, baseDice: number, amountKind?: 'HALF'): DamageAuthored => ({
  id: spellChildId(SPELL_IDS.ACID_ARROW, bucket, 1),
  effectKind: EFFECT_KIND.DAMAGE,
  damageTypeId: damageTypeId('ACID'),
  valueKind: DAMAGE_VALUE_KIND.DICE,
  scalingKind: SCALING.PER_LEVEL,
  scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
  levels: Array.from({ length: 8 }, (_, index) => ({
    id: spellChildId(SPELL_IDS.ACID_ARROW, bucket + 1, index + 1),
    level: index + 2,
    order: index + 1,
    diceConfig: `${baseDice + index}d4`
  })),
  ...(amountKind ? { amountKind } : {})
})

const delayedAcidDamage: ManifestBehaviorAuthored = {
  id: spellChildId(SPELL_IDS.ACID_ARROW, 0x230, 1),
  order: 1,
  invocation: {
    kind: 'PASSIVE',
    triggerCode: TRIGGER.ACTIVATED,
    range: {
      id: spellChildId(SPELL_IDS.ACID_ARROW, 0x231, 1),
      rangeKind: RANGE_KIND.SELF
    }
  },
  paths: [
    {
      id: spellChildId(SPELL_IDS.ACID_ARROW, 0x232, 1),
      order: 1,
      pathCode: PATH_CODE.ON_USE,
      groupType: PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: `${spellChildId(SPELL_IDS.ACID_ARROW, 0x232, 1)}__result`,
        resultKind: 'SINGLE',
        outcomes: [acidDamage(0x233, 2)]
      }
    }
  ]
}

export const acidArrow: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ACID_ARROW,
  label: 'Acid Arrow',
  description:
    "<p>A shimmering green arrow streaks toward a target within range and bursts in a spray of acid. Make a ranged spell attack against the target. On a hit, the target takes 4d4 acid damage immediately and 2d4 acid damage at the end of its next turn. On a miss, the arrow splashes the target with acid for half as much of the initial damage and no damage at the end of its next turn. At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, the damage (both initial and later) increases by 1d4 for each slot level above 2nd.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: "powdered rhubarb leaf and an adder's stomach",
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.ACID_ARROW, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ACID_ARROW, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 90,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.ACID_ARROW, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.ACID_ARROW, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              acidDamage(0x220, 4),
              {
                id: spellChildId(SPELL_IDS.ACID_ARROW, 0x222, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: 'OBJECT' as const,
                attachmentKind: 'PRIMARY_TARGET' as const,
                label: 'Lingering acid',
                components: [
                  {
                    id: spellChildId(SPELL_IDS.ACID_ARROW, 0x223, 1),
                    order: 1,
                    label: 'End of target next turn',
                    interactionKind: 'END_OF_ATTACHED_TARGET_NEXT_TURN' as const,
                    behaviors: [delayedAcidDamage]
                  }
                ]
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.ACID_ARROW, 0x213, 1),
          order: 2,
          pathCode: PATH_CODE.ON_MISS,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.ACID_ARROW, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [acidDamage(0x240, 4, 'HALF')]
          }
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
