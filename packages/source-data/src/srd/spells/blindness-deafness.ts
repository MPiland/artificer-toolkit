import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALABLE_SCALING_KIND,
  SCALING_SOURCE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
const conditions = [
  { code: 'BLINDED', label: 'Blindness' },
  { code: 'DEAFENED', label: 'Deafness' }
] as const
export const blindnessDeafness: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.BLINDNESS_DEAFNESS,
  label: 'Blindness/Deafness',
  description:
    '<p>You can blind or deafen a foe. Choose one creature that you can see within range to make a Constitution saving throw. If it fails, the target is either blinded or deafened (your choice) for the duration. At the end of each of its turns, the target can make a Constitution saving throw. On a success, the spell ends. At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, you can target one additional creature for each slot level above 2nd.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL],
  magicSchoolId: schoolId('NECROMANCY'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x214, 2),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY,
          // One creature, and one more for each slot level above 2nd.
          maxTargetsScaling: {
            scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
            scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
            breakpoints: Array.from({ length: 8 }, (_, index) => ({
              id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x226, index + 1),
              level: index + 2,
              order: index + 1,
              value: { amount: index + 1 }
            }))
          }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE' as const,
          selectionKind: 'CHOICE' as const,
          options: conditions.map(({ code, label }, index) => ({
            id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x220, index + 1),
            order: index + 1,
            label,
            description:
              'If it fails, the target is either blinded or deafened (your choice) for the duration. At the end of each of its turns, the target can make a Constitution saving throw. On a success, the spell ends.',
            resultBlock: {
              id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x221, index + 1),
              resultKind: 'SEQUENCE' as const,
              duration: {
                id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x222, index + 1),
                durationKind: DURATION_KIND.MINUTE,
                amount: 1
              },
              outcomes: [
                {
                  id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x223, index + 1),
                  effectKind: EFFECT_KIND.CONDITION,
                  conditionId: conditionTypeId(code)
                },
                {
                  id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x224, index + 1),
                  effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                  timing: 'TARGET_TURN_END' as const,
                  savingThrow: {
                    id: spellChildId(SPELL_IDS.BLINDNESS_DEAFNESS, 0x225, index + 1),
                    dcMethod: 'SOURCE_SAVE_DC' as const,
                    abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION
                  },
                  attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
                  onSuccess: { kind: 'END' as const },
                  onFailure: { kind: 'CONTINUE' as const }
                }
              ]
            }
          }))
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
