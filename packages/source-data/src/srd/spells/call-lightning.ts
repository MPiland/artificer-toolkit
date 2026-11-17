import { SRD_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
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
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const BOLT_EFFECT_KEY = 0x220
const BOLT_EFFECT_ID = spellChildId(SPELL_IDS.CALL_LIGHTNING, BOLT_EFFECT_KEY, 1)

/** A bolt's damage path: 3d10 lightning, 1d10 more per slot level above 3rd, halved on a success. */
function boltPath(
  pathCode: typeof PATH_CODE.ON_SAVE_FAIL | typeof PATH_CODE.ON_SAVE_SUCCESS,
  idKey: number,
  order: number
) {
  return {
    id: spellChildId(SPELL_IDS.CALL_LIGHTNING, idKey, 1),
    order,
    pathCode,
    groupType: PATH_GROUP_TYPE.SINGLE,
    originKind: 'SOURCE' as const,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: spellChildId(SPELL_IDS.CALL_LIGHTNING, idKey, 1) + '__result',
      resultKind: 'SINGLE' as const,
      outcomes: [
        {
          id: spellChildId(SPELL_IDS.CALL_LIGHTNING, idKey, 1),
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('LIGHTNING'),
          ...(pathCode === PATH_CODE.ON_SAVE_SUCCESS && { amountKind: SCALING_AMOUNT_KIND.HALF }),
          valueKind: 'DICE' as const,
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
          levels: [3, 4, 5, 6, 7, 8, 9].map((level, index) => ({
            id: spellChildId(SPELL_IDS.CALL_LIGHTNING, idKey, 2 + index),
            level,
            order: index + 1,
            diceConfig: `${level}d10`
          }))
        }
      ]
    }
  }
}

export const callLightning: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.CALL_LIGHTNING,
  label: 'Call Lightning',
  description:
    "<p>A storm cloud appears in the shape of a cylinder that is 10 feet tall with a 60-foot radius, centered on a point you can see 100 feet directly above you. The spell fails if you can't see a point in the air where the storm cloud could appear (for example, if you are in a room that can't accommodate the cloud). When you cast the spell, choose a point you can see within range. A bolt of lightning flashes down from the cloud to that point. Each creature within 5 feet of that point must make a Dexterity saving throw. A creature takes 3d10 lightning damage on a failed save, or half as much damage on a successful one. On each of your turns until the spell ends, you can use your action to call down lightning in this way again, targeting the same point or a different one. If you are outdoors in stormy conditions when you cast this spell, the spell gives you control over the existing storm instead of creating a new one. Under such conditions, the spell's damage increases by 1d10. At Higher Levels. When you cast this spell using a spell slot of 4th or higher level, the damage increases by 1d10 for each slot level above 3rd.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.CALL_LIGHTNING, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CALL_LIGHTNING, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.CALL_LIGHTNING, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.CALL_LIGHTNING, 0x213, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.CALL_LIGHTNING, 0x212, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 10
            },
            // The cloud stays while the caster concentrates: the cast's bolt is its first call, free
            // on the cast turn, and each later call costs the caster's action (D190a).
            lifecycle: {
              effectOffers: [
                {
                  kind: 'REPEAT_SOURCE_PATH' as const,
                  offeredTo: 'SOURCE' as const,
                  activation: ACTIVATION_CODE.ACTION,
                  effectId: BOLT_EFFECT_ID,
                  target: 'INVOCATION' as const,
                  castTurnUse: 'FREE_ONCE' as const
                }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.CALL_LIGHTNING, 0x214, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {}
              },
              {
                id: spellChildId(SPELL_IDS.CALL_LIGHTNING, 0x213, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Resolve Existing Weather',
                reasonCode: 'EXTERNAL_WORLD_STATE' as const,
                instructions:
                  "If you are outdoors in stormy conditions when you cast this spell, the spell gives you control over the existing storm instead of creating a new one. Under such conditions, the spell's damage increases by 1d10."
              }
            ]
          }
        }
      ]
    },
    {
      id: BOLT_EFFECT_ID,
      order: 2,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.CALL_LIGHTNING, BOLT_EFFECT_KEY + 4, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.CALL_LIGHTNING, BOLT_EFFECT_KEY + 1, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: {
          id: spellChildId(SPELL_IDS.CALL_LIGHTNING, BOLT_EFFECT_KEY + 2, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 5,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      paths: [
        boltPath(PATH_CODE.ON_SAVE_FAIL, BOLT_EFFECT_KEY + 3, 1),
        boltPath(PATH_CODE.ON_SAVE_SUCCESS, BOLT_EFFECT_KEY + 5, 2)
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
