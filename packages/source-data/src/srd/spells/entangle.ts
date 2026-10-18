import {
  TARGET_DISPOSITION_KIND,
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import { conditionTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const entangle: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ENTANGLE,
  label: 'Entangle',
  description:
    '<p>Grasping weeds and vines sprout from the ground in a 20-foot square starting from a point within range. For the duration, these plants turn the ground in the area into difficult terrain. A creature in the area when you cast the spell must succeed on a Strength saving throw or be restrained by the entangling plants until the spell ends. A creature restrained by the plants can use its action to make a Strength check against your spell save DC. On a success, it frees itself. When the spell ends, the conjured plants wilt away.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.ENTANGLE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        // The save each creature in the area makes when the plants sprout: its only save,
        // restrained until the spell ends or it breaks free.
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.ENTANGLE, 0x230, 1),
          dcMethod: 'SOURCE_SAVE_DC' as const,
          abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.STRENGTH
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ENTANGLE, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 90,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: {
          id: spellChildId(SPELL_IDS.ENTANGLE, 0x212, 1),
          shapeKind: SHAPE_KIND.CUBE,
          edgeLength: {
            amount: 20,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        },
        targeting: {
          selectionKind: 'AREA_CONTENTS',
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.ENTANGLE, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.ENTANGLE, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.ENTANGLE, 0x214, 1),
              durationKind: 'MINUTE',
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.ENTANGLE, 0x213, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE,
                attachmentKind: 'PLACED_SPACE',
                label: 'Entangle',
                shape: {
                  id: spellChildId(SPELL_IDS.ENTANGLE, 0x220, 1),
                  shapeKind: SHAPE_KIND.CUBE,
                  edgeLength: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
                },
                components: [
                  {
                    id: spellChildId(SPELL_IDS.ENTANGLE, 0x221, 1),
                    order: 1,
                    label: 'Grasping plants',
                    // The area is difficult terrain.
                    movementCostMultiplier: 2
                  }
                ]
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.ENTANGLE, 0x231, 1),
          order: 2,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: `${spellChildId(SPELL_IDS.ENTANGLE, 0x231, 1)}__result`,
            resultKind: 'SINGLE' as const,
            lifecycle: {
              heldBySource: true,
              escape: {
                activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
                checks: {
                  skillIds: [],
                  abilityDefinitionIds: [SRD_ABILITY_DEFINITION_IDS.STRENGTH]
                },
                dc: { kind: 'SOURCE_SAVE_DC' as const }
              }
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.ENTANGLE, 0x232, 1),
                effectKind: EFFECT_KIND.CONDITION,
                conditionId: conditionTypeId('RESTRAINED')
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
