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
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SHAPE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_MAGIC_SCHOOLS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'
import { damageTypeId, spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}
/** Within 10 feet of the Large guardian: 15 feet from the centre of its 10-foot space. */
const guardianReach = (kind: number) => ({
  id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, kind, 1),
  shapeKind: SHAPE_KIND.SPHERE,
  radius: { amount: 15, unit: MEASUREMENT_UNIT_CODE.FEET }
})
const guardianDamage = (kind: number) => ({
  id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, kind, 1),
  effectKind: EFFECT_KIND.DAMAGE,
  damageTypeId: damageTypeId('RADIANT'),
  valueKind: DAMAGE_VALUE_KIND.FIXED,
  scalingKind: SCALING.NONE,
  amount: 20
})
export const guardianOfFaith: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.GUARDIAN_OF_FAITH,
  label: 'Guardian of Faith',
  description:
    '<p>A Large spectral guardian appears and hovers for the duration in an unoccupied space of your choice that you can see within range. The guardian occupies that space and is indistinct except for a gleaming sword and shield emblazoned with the symbol of your deity. Any creature hostile to you that moves to a space within 10 feet of the guardian for the first time on a turn must succeed on a Dexterity saving throw. The creature takes 20 radiant damage on a failed save, or half as much damage on a successful one. The guardian vanishes when it has dealt a total of 60 damage.</p><p>GM ruling: when you cast the spell, you leave your allies unaffected by the guardian. The GM ends the spell once the guardian has dealt a total of 60 damage.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL],
  magicSchoolId: schoolId('CONJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: guardianReach(0x215)
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x214, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 8
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x212, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE,
                attachmentKind: 'PLACED_SPACE' as const,
                label: 'Guardian of Faith',
                shape: guardianReach(0x220),
                components: [
                  {
                    id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x221, 1),
                    order: 1,
                    label: 'Approach the guardian',
                    interactionKinds: ['ENTER_OR_PASS_THROUGH' as const],
                    // Only creatures hostile to the caster are affected: the caster leaves allies unaffected.
                    choosesUnaffected: true,
                    maxApplicationsPerTurn: 1,
                    behaviors: [
                      {
                        id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x222, 1),
                        order: 1,
                        invocation: {
                          kind: 'PASSIVE' as const,
                          triggerCode: TRIGGER.SAVING_THROW,
                          savingThrow: {
                            id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x223, 1),
                            dcMethod: 'SOURCE_SAVE_DC' as const,
                            abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
                          },
                          range: {
                            id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x224, 1),
                            rangeKind: RANGE_KIND.SELF
                          }
                        },
                        paths: [
                          {
                            id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x225, 1),
                            order: 1,
                            pathCode: PATH_CODE.ON_SAVE_FAIL,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x225, 1)}__result`,
                              resultKind: 'SINGLE' as const,
                              outcomes: [guardianDamage(0x226)]
                            }
                          },
                          {
                            id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x227, 1),
                            order: 2,
                            pathCode: PATH_CODE.ON_SAVE_SUCCESS,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x227, 1)}__result`,
                              resultKind: 'SINGLE' as const,
                              outcomes: [
                                {
                                  ...guardianDamage(0x228),
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
              },
              {
                id: spellChildId(SPELL_IDS.GUARDIAN_OF_FAITH, 0x2f0, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Dismiss the guardian',
                reasonCode: 'GM_CHOICE' as const,
                instructions:
                  'The guardian vanishes, and the spell ends, once it has dealt a total of 60 damage. The guardian occupies its space.'
              }
            ]
          }
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
