import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
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
import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  conditionTypeId,
  damageTypeId,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'
export const sunbeam: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SUNBEAM,
  label: 'Sunbeam',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  description:
    "<p>A beam of brilliant light flashes out from your hand in a 5-foot-wide, 60-foot-long line. Each creature in the line must make a Constitution saving throw. On a failed save, a creature takes 6d8 radiant damage and is blinded until your next turn. On a successful save, it takes half as much damage and isn't blinded by this spell. Undead and oozes have disadvantage on this saving throw. You can create a new line of radiance as your action on any turn until the spell ends. For the duration, a mote of brilliant radiance shines in your hand. It sheds bright light in a 30-foot radius and dim light for an additional 30 feet. This light is sunlight.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a magnifying glass',
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SUNBEAM, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.SUNBEAM, 0x218, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SUNBEAM, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: {
          id: spellChildId(SPELL_IDS.SUNBEAM, 0x212, 1),
          shapeKind: SHAPE_KIND.LINE,
          length: {
            amount: 60,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      // The fresh line each turn as an action, undead and oozes' disadvantage and the sunlight mote
      // stay with the description (D187a).
      paths: [
        {
          id: spellChildId(SPELL_IDS.SUNBEAM, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SUNBEAM, 0x213, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            // Blinded until the caster's next turn.
            duration: {
              id: spellChildId(SPELL_IDS.SUNBEAM, 0x214, 1),
              durationKind: DURATION_KIND.ROUND,
              amount: 1
            },
            lifecycle: { turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' } },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SUNBEAM, 0x213, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('RADIANT'),
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.NONE,
                diceConfig: '6d8'
              },
              {
                id: spellChildId(SPELL_IDS.SUNBEAM, 0x216, 1),
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: conditionTypeId('BLINDED')
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.SUNBEAM, 0x217, 1),
          order: 2,
          pathCode: PATH_CODE.ON_SAVE_SUCCESS,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SUNBEAM, 0x217, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SUNBEAM, 0x217, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('RADIANT'),
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.NONE,
                diceConfig: '6d8',
                multiplier: 0.5
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
