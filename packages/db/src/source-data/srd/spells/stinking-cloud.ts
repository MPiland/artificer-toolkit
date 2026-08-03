import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  ACTION_ECONOMY_RULE_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SPELL_COMPONENT,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type ManifestBehaviorAuthored,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

const stinkingCloudSave: ManifestBehaviorAuthored = {
  id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x410, 1),
  order: 1,
  invocation: {
    kind: 'PASSIVE',
    triggerCode: TRIGGER.SAVING_THROW,
    savingThrow: {
      id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x411, 1),
      dcMethod: 'SOURCE_SAVE_DC',
      ability: ABILITY_CODE.CONSTITUTION
    },
    range: {
      id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x412, 1),
      rangeKind: RANGE_KIND.SELF
    }
  },
  paths: [
    {
      id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x413, 1),
      order: 1,
      pathCode: PATH_CODE.ON_SAVE_FAIL,
      groupType: PATH_GROUP_TYPE.SINGLE,
      originKind: 'SOURCE',
      selectionKind: 'FIXED',
      resultBlock: {
        id: `${spellChildId(SPELL_IDS.STINKING_CLOUD, 0x413, 1)}__result`,
        resultKind: 'SINGLE',
        outcomes: [
          {
            id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x414, 1),
            effectKind: EFFECT_KIND.ACTION_ECONOMY_RULE,
            ruleKind: ACTION_ECONOMY_RULE_KIND.LOSE_ACTION
          }
        ]
      }
    }
  ]
}

export const stinkingCloud: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.STINKING_CLOUD,
  label: 'Stinking Cloud',
  description:
    "<p>You create a 20-foot-radius sphere of yellow, nauseating gas centered on a point within range. The cloud spreads around corners, and its area is heavily obscured. The cloud lingers in the air for the duration. Each creature that is completely within the cloud at the start of its turn must make a Constitution saving throw against poison. On a failed save, the creature spends its action that turn retching and reeling. Creatures that don't need to breathe or are immune to poison automatically succeed on this saving throw. A moderate wind (at least 10 miles per hour) disperses the cloud after 4 rounds. A strong wind (at least 20 miles per hour) disperses it after 1 round.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a rotten egg or several skunk cabbage leaves',
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 90,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: {
          id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x212, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: `${spellChildId(SPELL_IDS.STINKING_CLOUD, 0x213, 1)}__result`,
            resultKind: 'SINGLE',
            duration: {
              id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x214, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x400, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE,
                label: 'Stinking Cloud',
                shape: {
                  id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x401, 1),
                  shapeKind: SHAPE_KIND.SPHERE,
                  radius: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
                },
                spreadsAroundCorners: true,
                obscurementKind: 'HEAVY',
                components: [
                  {
                    id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x402, 1),
                    order: 1,
                    label: 'Nauseating Gas',
                    interactionKinds: ['START_TURN_IN_SPACE'],
                    requiresFullyWithin: true,
                    automaticSaveSuccessConditions: ['DOES_NOT_BREATHE', 'POISON_IMMUNE'],
                    behaviors: [stinkingCloudSave]
                  }
                ],
                destructionCriteria: [
                  {
                    id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x403, 1),
                    order: 1,
                    kind: 'WIND_SPEED',
                    minimumMilesPerHour: 10,
                    afterRounds: 4
                  },
                  {
                    id: spellChildId(SPELL_IDS.STINKING_CLOUD, 0x403, 2),
                    order: 2,
                    kind: 'WIND_SPEED',
                    minimumMilesPerHour: 20,
                    afterRounds: 1
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
