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
/** The beam: a 5-foot-radius, 40-foot-high cylinder. */
const beam = (kind: number) => ({
  id: spellChildId(SPELL_IDS.MOONBEAM, kind, 1),
  shapeKind: SHAPE_KIND.CYLINDER,
  radius: { amount: 5, unit: MEASUREMENT_UNIT_CODE.FEET },
  height: { amount: 40, unit: MEASUREMENT_UNIT_CODE.FEET }
})
/** The ghostly flames' radiant damage: 2d10 cast at the 2nd level, and 1d10 more for each slot level above it. */
const zoneDamage = (kind: number) => ({
  id: spellChildId(SPELL_IDS.MOONBEAM, kind, 1),
  effectKind: EFFECT_KIND.DAMAGE,
  damageTypeId: damageTypeId('RADIANT'),
  valueKind: DAMAGE_VALUE_KIND.DICE,
  scalingKind: SCALING.PER_LEVEL,
  scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
  levels: Array.from({ length: 8 }, (_, index) => ({
    id: spellChildId(SPELL_IDS.MOONBEAM, kind, index + 2),
    level: index + 2,
    order: index + 1,
    diceConfig: `${index + 2}d10`
  }))
})
export const moonbeam: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MOONBEAM,
  label: 'Moonbeam',
  description:
    "<p>A silvery beam of pale light shines down in a 5-foot-radius, 40-foot-high cylinder centered on a point within range. Until the spell ends, dim light fills the cylinder. When a creature enters the spell's area for the first time on a turn or starts its turn there, it is engulfed in ghostly flames that cause searing pain, and it must make a Constitution saving throw. It takes 2d10 radiant damage on a failed save, or half as much damage on a successful one. A shapechanger makes its saving throw with disadvantage. If it fails, it also instantly reverts to its original form and can't assume a different form until it leaves the spell's light. On each of your turns after you cast this spell, you can use an action to move the beam 60 feet in any direction. At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, the damage increases by 1d10 for each slot level above 2nd.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'several seeds of any moonseed plant and a piece of opalescent feldspar',
  magicSchoolId: schoolId('EVOCATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.MOONBEAM, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MOONBEAM, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: beam(0x215),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.MOONBEAM, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.MOONBEAM, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.MOONBEAM, 0x214, 1),
              durationKind: 'MINUTE',
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.MOONBEAM, 0x212, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE,
                attachmentKind: 'PLACED_SPACE',
                label: 'Moonbeam',
                shape: beam(0x220),
                components: [
                  {
                    id: spellChildId(SPELL_IDS.MOONBEAM, 0x221, 1),
                    order: 1,
                    label: 'Enter the moonlight',
                    interactionKinds: ['ENTER_SPACE' as const, 'START_TURN_IN_SPACE' as const],
                    maxApplicationsPerTurn: 1,
                    behaviors: [
                      {
                        id: spellChildId(SPELL_IDS.MOONBEAM, 0x222, 1),
                        order: 1,
                        invocation: {
                          kind: 'PASSIVE' as const,
                          triggerCode: TRIGGER.SAVING_THROW,
                          savingThrow: {
                            id: spellChildId(SPELL_IDS.MOONBEAM, 0x223, 1),
                            dcMethod: 'SOURCE_SAVE_DC' as const,
                            abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION
                          },
                          range: {
                            id: spellChildId(SPELL_IDS.MOONBEAM, 0x224, 1),
                            rangeKind: RANGE_KIND.SELF
                          }
                        },
                        paths: [
                          {
                            id: spellChildId(SPELL_IDS.MOONBEAM, 0x225, 1),
                            order: 1,
                            pathCode: PATH_CODE.ON_SAVE_FAIL,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${spellChildId(SPELL_IDS.MOONBEAM, 0x225, 1)}__result`,
                              resultKind: 'SINGLE' as const,
                              outcomes: [zoneDamage(0x226)]
                            }
                          },
                          {
                            id: spellChildId(SPELL_IDS.MOONBEAM, 0x227, 1),
                            order: 2,
                            pathCode: PATH_CODE.ON_SAVE_SUCCESS,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${spellChildId(SPELL_IDS.MOONBEAM, 0x227, 1)}__result`,
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
