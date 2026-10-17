import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
/** The fog's poison damage: 5d8 cast at the 5th level, and 1d8 more for each slot level above it. */
const zoneDamage = (kind: number) => ({
  id: spellChildId(SPELL_IDS.CLOUDKILL, kind, 1),
  effectKind: EFFECT_KIND.DAMAGE,
  damageTypeId: damageTypeId('POISON'),
  valueKind: DAMAGE_VALUE_KIND.DICE,
  scalingKind: SCALING.PER_LEVEL,
  scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
  levels: Array.from({ length: 5 }, (_, index) => ({
    id: spellChildId(SPELL_IDS.CLOUDKILL, kind, index + 2),
    level: index + 5,
    order: index + 1,
    diceConfig: `${index + 5}d8`
  }))
})
export const cloudkill: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.CLOUDKILL,
  label: 'Cloudkill',
  description:
    "<p>You create a 20-foot-radius sphere of poisonous, yellow-green fog centered on a point you choose within range. The fog spreads around corners. It lasts for the duration or until strong wind disperses the fog, ending the spell. Its area is heavily obscured. When a creature enters the spell's area for the first time on a turn or starts its turn there, that creature must make a Constitution saving throw. The creature takes 5d8 poison damage on a failed save, or half as much damage on a successful one.</p><p>Creatures are affected even if they hold their breath or don't need to breathe. The fog moves 10 feet away from you at the start of each of your turns, rolling along the surface of the ground. The vapors, being heavier than air, sink to the lowest level of the land, even pouring down openings. At Higher Levels. When you cast this spell using a spell slot of 6th level or higher, the damage increases by 1d8 for each slot level above 5th.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.CLOUDKILL, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CLOUDKILL, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: {
          id: spellChildId(SPELL_IDS.CLOUDKILL, 0x212, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 20,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.CLOUDKILL, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.CLOUDKILL, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.CLOUDKILL, 0x214, 1),
              durationKind: 'MINUTE',
              amount: 10
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.CLOUDKILL, 0x213, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE,
                attachmentKind: 'PLACED_SPACE',
                label: 'Cloudkill',
                shape: {
                  id: spellChildId(SPELL_IDS.CLOUDKILL, 0x220, 1),
                  shapeKind: SHAPE_KIND.SPHERE,
                  radius: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
                },
                components: [
                  {
                    id: spellChildId(SPELL_IDS.CLOUDKILL, 0x221, 1),
                    order: 1,
                    label: 'Enter the poisonous fog',
                    interactionKinds: ['ENTER_SPACE' as const, 'START_TURN_IN_SPACE' as const],
                    maxApplicationsPerTurn: 1,
                    behaviors: [
                      {
                        id: spellChildId(SPELL_IDS.CLOUDKILL, 0x222, 1),
                        order: 1,
                        invocation: {
                          kind: 'PASSIVE' as const,
                          triggerCode: TRIGGER.SAVING_THROW,
                          savingThrow: {
                            id: spellChildId(SPELL_IDS.CLOUDKILL, 0x223, 1),
                            dcMethod: 'SOURCE_SAVE_DC' as const,
                            abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION
                          },
                          range: {
                            id: spellChildId(SPELL_IDS.CLOUDKILL, 0x224, 1),
                            rangeKind: RANGE_KIND.SELF
                          }
                        },
                        paths: [
                          {
                            id: spellChildId(SPELL_IDS.CLOUDKILL, 0x225, 1),
                            order: 1,
                            pathCode: PATH_CODE.ON_SAVE_FAIL,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${spellChildId(SPELL_IDS.CLOUDKILL, 0x225, 1)}__result`,
                              resultKind: 'SINGLE' as const,
                              outcomes: [zoneDamage(0x226)]
                            }
                          },
                          {
                            id: spellChildId(SPELL_IDS.CLOUDKILL, 0x227, 1),
                            order: 2,
                            pathCode: PATH_CODE.ON_SAVE_SUCCESS,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${spellChildId(SPELL_IDS.CLOUDKILL, 0x227, 1)}__result`,
                              resultKind: 'SINGLE' as const,
                              outcomes: [
                                { ...zoneDamage(0x228), amountKind: SCALING_AMOUNT_KIND.HALF }
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
          }
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
