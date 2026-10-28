import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SPELL_COMPONENT,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type ManifestAuthored,
  type ManifestBehaviorAuthored,
  type ShapeAuthored,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const createBladeBehavior = (scope: number): ManifestBehaviorAuthored => ({
  id: spellChildId(SPELL_IDS.BLADE_BARRIER, scope + 0x10, 1),
  order: 1,
  invocation: {
    kind: 'PASSIVE',
    triggerCode: TRIGGER.SAVING_THROW,
    savingThrow: {
      id: spellChildId(SPELL_IDS.BLADE_BARRIER, scope + 0x11, 1),
      dcMethod: 'SOURCE_SAVE_DC',
      abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.DEXTERITY
    },
    range: {
      id: spellChildId(SPELL_IDS.BLADE_BARRIER, scope + 0x12, 1),
      rangeKind: RANGE_KIND.SELF
    }
  },
  paths: [
    {
      id: spellChildId(SPELL_IDS.BLADE_BARRIER, scope + 0x13, 1),
      order: 1,
      pathCode: PATH_CODE.ON_SAVE_FAIL,
      groupType: PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: `${spellChildId(SPELL_IDS.BLADE_BARRIER, scope + 0x13, 1)}__result`,
        resultKind: 'SINGLE',
        outcomes: [
          {
            id: spellChildId(SPELL_IDS.BLADE_BARRIER, scope + 0x14, 1),
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: damageTypeId('SLASHING'),
            valueKind: 'DICE',
            scalingKind: SCALING.NONE,
            diceConfig: '6d10'
          }
        ]
      }
    },
    {
      id: spellChildId(SPELL_IDS.BLADE_BARRIER, scope + 0x15, 1),
      order: 2,
      pathCode: PATH_CODE.ON_SAVE_SUCCESS,
      groupType: PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: `${spellChildId(SPELL_IDS.BLADE_BARRIER, scope + 0x15, 1)}__result`,
        resultKind: 'SINGLE',
        outcomes: [
          {
            id: spellChildId(SPELL_IDS.BLADE_BARRIER, scope + 0x16, 1),
            effectKind: EFFECT_KIND.DAMAGE,
            damageTypeId: damageTypeId('SLASHING'),
            valueKind: 'DICE',
            scalingKind: SCALING.NONE,
            amountKind: SCALING_AMOUNT_KIND.HALF,
            diceConfig: '6d10'
          }
        ]
      }
    }
  ]
})

const createBladeManifest = (
  scope: number,
  label: string,
  shape: ShapeAuthored,
  ring = false
): ManifestAuthored => ({
  id: spellChildId(SPELL_IDS.BLADE_BARRIER, scope, 1),
  effectKind: EFFECT_KIND.MANIFEST,
  manifestKind: MANIFEST_KIND.ZONE,
  attachmentKind: 'PLACED_SPACE',
  label,
  shape,
  ...(ring
    ? {
        hollow: true,
        wallThickness: { amount: 5, unit: MEASUREMENT_UNIT_CODE.FEET }
      }
    : {}),
  components: [
    {
      id: spellChildId(SPELL_IDS.BLADE_BARRIER, scope + 1, 1),
      order: 1,
      label: 'Whirling Blades',
      interactionKinds: ['ENTER_OR_PASS_THROUGH', 'START_TURN_IN_SPACE'],
      movementCostMultiplier: 2,
      maxApplicationsPerTurn: 1,
      blockingRules: ['THREE_QUARTERS_COVER'],
      behaviors: [createBladeBehavior(scope)]
    }
  ]
})

export const bladeBarrier: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.BLADE_BARRIER,
  label: 'Blade Barrier',
  description:
    "<p>You create a vertical wall of whirling, razor-sharp blades made of magical energy. The wall appears within range and lasts for the duration. You can make a straight wall up to 100 feet long, 20 feet high, and 5 feet thick, or a ringed wall up to 60 feet in diameter, 20 feet high, and 5 feet thick. The wall provides three-quarters cover to creatures behind it, and its space is difficult terrain. When a creature enters the wall's area for the first time on a turn or starts its turn there, the creature must make a Dexterity saving throw. On a failed save, the creature takes 6d10 slashing damage. On a successful save, the creature takes half as much damage.</p><p>GM ruling: the wall's cover is not applied automatically. Give a creature behind the wall three-quarters cover with its token's cover override.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('EVOCATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.BLADE_BARRIER, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: spellChildId(SPELL_IDS.BLADE_BARRIER, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 90,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.BLADE_BARRIER, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.CHOICE,
          originKind: 'SOURCE',
          selectionKind: 'CHOICE',
          options: [
            {
              id: spellChildId(SPELL_IDS.BLADE_BARRIER, 0x213, 1),
              order: 1,
              label: 'Straight Wall',
              description:
                'You can make a straight wall up to 100 feet long, 20 feet high, and 5 feet thick, or a ringed wall up to 60 feet in diameter, 20 feet high, and 5 feet thick.',
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.BLADE_BARRIER, 0x213, 1)}__result`,
                resultKind: 'SINGLE',
                duration: {
                  id: spellChildId(SPELL_IDS.BLADE_BARRIER, 0x214, 1),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 10
                },
                outcomes: [
                  createBladeManifest(0x400, 'Blade Barrier Wall', {
                    id: spellChildId(SPELL_IDS.BLADE_BARRIER, 0x401, 1),
                    shapeKind: SHAPE_KIND.WALL,
                    length: { amount: 100, unit: MEASUREMENT_UNIT_CODE.FEET },
                    height: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET },
                    thickness: { amount: 5, unit: MEASUREMENT_UNIT_CODE.FEET }
                  })
                ]
              }
            },
            {
              id: spellChildId(SPELL_IDS.BLADE_BARRIER, 0x213, 2),
              order: 2,
              label: 'Ringed Wall',
              description:
                'You can make a straight wall up to 100 feet long, 20 feet high, and 5 feet thick, or a ringed wall up to 60 feet in diameter, 20 feet high, and 5 feet thick.',
              resultBlock: {
                id: `${spellChildId(SPELL_IDS.BLADE_BARRIER, 0x213, 2)}__result`,
                resultKind: 'SINGLE',
                duration: {
                  id: spellChildId(SPELL_IDS.BLADE_BARRIER, 0x214, 2),
                  durationKind: DURATION_KIND.MINUTE,
                  amount: 10
                },
                outcomes: [
                  createBladeManifest(
                    0x500,
                    'Blade Barrier Ring',
                    {
                      id: spellChildId(SPELL_IDS.BLADE_BARRIER, 0x501, 1),
                      shapeKind: SHAPE_KIND.CYLINDER,
                      radius: { amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET },
                      height: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
                    },
                    true
                  )
                ]
              }
            }
          ]
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
