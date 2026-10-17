import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  SCALING,
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
  SPELL_ATTRIBUTE,
  RANGE_KIND,
  SUBJECT,
  SHAPE_KIND,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
/** The aura's damage: 3d8 cast at the 3rd level, and 1d8 more for each slot level above it. */
const auraDamage = (damageType: 'RADIANT' | 'NECROTIC', kind: number) => ({
  id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, kind, 1),
  effectKind: EFFECT_KIND.DAMAGE,
  damageTypeId: damageTypeId(damageType),
  valueKind: DAMAGE_VALUE_KIND.DICE,
  scalingKind: SCALING.PER_LEVEL,
  scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
  levels: Array.from({ length: 7 }, (_, index) => ({
    id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, kind, index + 2),
    level: index + 3,
    order: index + 1,
    diceConfig: `${index + 3}d8`
  }))
})

/**
 * The aura that deals one damage type. The spell authors it once and its cast-time options differ
 * only in the type (D140); each option keeps its ids in its own bucket.
 */
const auraResult = (damageType: 'RADIANT' | 'NECROTIC', bucket: number) => ({
  id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x13, 1) + '__result',
  resultKind: 'SINGLE' as const,
  duration: {
    id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x14, 1),
    durationKind: DURATION_KIND.MINUTE,
    amount: 10
  },
  outcomes: [
    {
      id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x13, 1),
      effectKind: EFFECT_KIND.MANIFEST,
      manifestKind: MANIFEST_KIND.ZONE,
      attachmentKind: 'SOURCE' as const,
      label: 'Spirit Guardians',
      shape: {
        id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x20, 1),
        shapeKind: SHAPE_KIND.SPHERE,
        radius: { amount: 15, unit: MEASUREMENT_UNIT_CODE.FEET }
      },
      components: [
        {
          id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x21, 1),
          order: 1,
          label: 'Enter the spirits',
          interactionKinds: ['ENTER_OR_PASS_THROUGH' as const, 'START_TURN_IN_SPACE' as const],
          choosesUnaffected: true,
          maxApplicationsPerTurn: 1,
          behaviors: [
            {
              id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x22, 1),
              order: 1,
              invocation: {
                kind: 'PASSIVE' as const,
                triggerCode: TRIGGER.SAVING_THROW,
                savingThrow: {
                  id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x23, 1),
                  dcMethod: 'SOURCE_SAVE_DC' as const,
                  abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM
                },
                range: {
                  id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x24, 1),
                  rangeKind: RANGE_KIND.SELF
                }
              },
              paths: [
                {
                  id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x25, 1),
                  order: 1,
                  pathCode: PATH_CODE.ON_SAVE_FAIL,
                  groupType: PATH_GROUP_TYPE.SINGLE,
                  originKind: 'SOURCE' as const,
                  selectionKind: 'FIXED' as const,
                  resultBlock: {
                    id: `${spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x25, 1)}__result`,
                    resultKind: 'SINGLE' as const,
                    outcomes: [auraDamage(damageType, bucket + 0x26)]
                  }
                },
                {
                  id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x27, 1),
                  order: 2,
                  pathCode: PATH_CODE.ON_SAVE_SUCCESS,
                  groupType: PATH_GROUP_TYPE.SINGLE,
                  originKind: 'SOURCE' as const,
                  selectionKind: 'FIXED' as const,
                  resultBlock: {
                    id: `${spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, bucket + 0x27, 1)}__result`,
                    resultKind: 'SINGLE' as const,
                    outcomes: [
                      {
                        ...auraDamage(damageType, bucket + 0x28),
                        amountKind: SCALING_AMOUNT_KIND.HALF
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ]
})

export const spiritGuardians: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SPIRIT_GUARDIANS,
  label: 'Spirit Guardians',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  description:
    "<p>You call forth spirits to protect you. They flit around you to a distance of 15 feet for the duration. If you are good or neutral, their spectral form appears angelic or fey (your choice). If you are evil, they appear fiendish. When you cast this spell, you can designate any number of creatures you can see to be unaffected by it. An affected creature's speed is halved in the area, and when the creature enters the area for the first time on a turn or starts its turn there, it must make a Wisdom saving throw. On a failed save, the creature takes 3d8 radiant damage (if you are good or neutral) or 3d8 necrotic damage (if you are evil). On a successful save, the creature takes half as much damage. At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d8 for each slot level above 3rd.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a holy symbol',
  magicSchoolId: schoolId('CONJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: {
          id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, 0x212, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 15,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE' as const,
          selectionKind: 'CHOICE' as const,
          options: [
            { label: 'Radiant', damageType: 'RADIANT' as const, bucket: 0x200 },
            { label: 'Necrotic (evil caster)', damageType: 'NECROTIC' as const, bucket: 0x300 }
          ].map(({ label, damageType, bucket }, index) => ({
            id: spellChildId(SPELL_IDS.SPIRIT_GUARDIANS, 0x215, index + 1),
            order: index + 1,
            label,
            description:
              '<p>The spirits deal radiant damage if you are good or neutral, or necrotic damage if you are evil.</p>',
            resultBlock: auraResult(damageType, bucket)
          }))
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
