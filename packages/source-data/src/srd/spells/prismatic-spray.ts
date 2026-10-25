import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
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
  conditionTypeId,
  damageTypeId,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'

const createDamageTableRow = (
  rowScope: number,
  outcomeScope: number,
  rollValue: number,
  damageCode: string,
  half: boolean
) => ({
  id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, rowScope, rollValue),
  order: rollValue,
  rollValue,
  resolutionKind: 'RESULT' as const,
  resultBlock: {
    id: `${spellChildId(SPELL_IDS.PRISMATIC_SPRAY, rowScope, rollValue)}__result`,
    resultKind: 'SINGLE' as const,
    outcomes: [
      {
        id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, outcomeScope, rollValue),
        effectKind: EFFECT_KIND.DAMAGE,
        damageTypeId: damageTypeId(damageCode),
        ...(half ? { amountKind: SCALING_AMOUNT_KIND.HALF } : {}),
        valueKind: 'DICE' as const,
        scalingKind: SCALING.NONE,
        diceConfig: '10d6'
      }
    ]
  }
})

const createRepeatTableRow = (rowScope: number) => ({
  id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, rowScope, 8),
  order: 8,
  rollValue: 8,
  resolutionKind: 'REPEAT_TABLE' as const,
  repeat: {
    count: 2,
    rerollValues: [
      {
        id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, rowScope + 1, 8),
        order: 1,
        value: 8
      }
    ]
  }
})
export const prismaticSpray: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PRISMATIC_SPRAY,
  label: 'Prismatic Spray',
  description:
    "<p>Eight multicolored rays of light flash from your hand. Each ray is a different color and has a different power and purpose. Each creature in a 60-foot cone must make a Dexterity saving throw. For each target, roll a d8 to determine which color ray affects it. 1. Red. The target takes 10d6 fire damage on a failed save, or half as much damage on a successful one. 2. Orange. The target takes 10d6 acid damage on a failed save, or half as much damage on a successful one. 3. Yellow. The target takes 10d6 lightning damage on a failed save, or half as much damage on a successful one. 4. Green. The target takes 10d6 poison damage on a failed save, or half as much damage on a successful one. 5. Blue. The target takes 10d6 cold damage on a failed save, or half as much damage on a successful one. 6. Indigo. On a failed save, the target is restrained. It must then make a Constitution saving throw at the end of each of its turns. If it successfully saves three times, the spell ends. If it fails its save three times, it permanently turns to stone and is subjected to the petrified condition. The successes and failures don't need to be consecutive; keep track of both until the target collects three of a kind.</p><p>7. Violet. On a failed save, the target is blinded. It must then make a Wisdom saving throw at the start of your next turn. A successful save ends the blindness. If it fails that save, the creature is transported to another plane of existence of the GM's choosing and is no longer blinded. (Typically, a creature that is on a plane that isn't its home plane is banished home, while other creatures are usually cast into the Astral or Ethereal planes.) 8. Special. The target is struck by two rays. Roll twice more, rerolling any 8.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 7,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x214, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: {
          id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x212, 1),
          shapeKind: SHAPE_KIND.CONE,
          length: {
            amount: 60,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'ROLL_TABLE' as const,
          rollTableKind: 'EXACT' as const,
          dieConfig: '1d8',
          rows: [
            createDamageTableRow(0x220, 0x230, 1, 'FIRE', false),
            createDamageTableRow(0x220, 0x230, 2, 'ACID', false),
            createDamageTableRow(0x220, 0x230, 3, 'LIGHTNING', false),
            createDamageTableRow(0x220, 0x230, 4, 'POISON', false),
            createDamageTableRow(0x220, 0x230, 5, 'COLD', false),
            {
              id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x220, 6),
              order: 6,
              rollValue: 6,
              resolutionKind: 'RESULT' as const,
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x220, 6)}__result`,
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x230, 6),
                    effectKind: EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('RESTRAINED')
                  },
                  {
                    id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x231, 6),
                    effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'TARGET_TURN_END' as const,
                    savingThrow: {
                      id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x232, 6),
                      dcMethod: 'SOURCE_SAVE_DC' as const,
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION
                    },
                    attempts: {
                      kind: 'THRESHOLDS' as const,
                      successesToEnd: 3,
                      failuresToResolve: 3,
                      consecutive: false
                    },
                    onSuccess: { kind: 'END' as const },
                    onFailure: {
                      kind: 'OUTCOMES' as const,
                      endCurrent: true,
                      resultKind: 'SINGLE' as const,
                      outcomes: [
                        {
                          id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x233, 6),
                          effectKind: EFFECT_KIND.CONDITION,
                          conditionId: conditionTypeId('PETRIFIED')
                        }
                      ]
                    }
                  }
                ]
              }
            },
            {
              id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x220, 7),
              order: 7,
              rollValue: 7,
              resolutionKind: 'RESULT' as const,
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x220, 7)}__result`,
                resultKind: 'SEQUENCE' as const,
                outcomes: [
                  {
                    id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x230, 7),
                    effectKind: EFFECT_KIND.CONDITION,
                    conditionId: conditionTypeId('BLINDED')
                  },
                  {
                    id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x231, 7),
                    effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'SOURCE_NEXT_TURN_START' as const,
                    savingThrow: {
                      id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x232, 7),
                      dcMethod: 'SOURCE_SAVE_DC' as const,
                      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
                    },
                    attempts: { kind: 'ONCE' as const },
                    onSuccess: { kind: 'END' as const },
                    onFailure: {
                      kind: 'OUTCOMES' as const,
                      endCurrent: true,
                      resultKind: 'SEQUENCE' as const,
                      outcomes: [
                        {
                          id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x233, 7),
                          effectKind: EFFECT_KIND.TELEPORT,
                          targetKind: 'TARGET' as const,
                          destinationKind: 'SPECIAL' as const
                        },
                        {
                          id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x234, 7),
                          effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                          label: 'Choose destination plane',
                          reasonCode: 'GM_CHOICE' as const,
                          instructions:
                            "If it fails that save, the creature is transported to another plane of existence of the GM's choosing and is no longer blinded."
                        }
                      ]
                    }
                  }
                ]
              }
            },
            createRepeatTableRow(0x220)
          ]
        },
        {
          id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x215, 1),
          order: 2,
          pathCode: PATH_CODE.ON_SAVE_SUCCESS,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'ROLL_TABLE' as const,
          rollTableKind: 'EXACT' as const,
          dieConfig: '1d8',
          rows: [
            createDamageTableRow(0x240, 0x250, 1, 'FIRE', true),
            createDamageTableRow(0x240, 0x250, 2, 'ACID', true),
            createDamageTableRow(0x240, 0x250, 3, 'LIGHTNING', true),
            createDamageTableRow(0x240, 0x250, 4, 'POISON', true),
            createDamageTableRow(0x240, 0x250, 5, 'COLD', true),
            // Indigo and violet do nothing to a creature that succeeds; the table still covers them.
            ...[6, 7].map((rollValue) => ({
              id: spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x240, rollValue),
              order: rollValue,
              rollValue,
              resolutionKind: 'RESULT' as const,
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.PRISMATIC_SPRAY, 0x240, rollValue)}__result`,
                resultKind: 'SINGLE' as const,
                outcomes: []
              }
            })),
            createRepeatTableRow(0x240)
          ]
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
