import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ATTACK_DOMAIN_CODE,
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const viciousMockery: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.VICIOUS_MOCKERY,
  label: 'Vicious Mockery',
  description:
    "<p>You unleash a string of insults laced with subtle enchantments at a creature you can see within range. If the target can hear you (though it need not understand you), it must succeed on a Wisdom saving throw or take 1d4 psychic damage and have disadvantage on the next attack roll it makes before the end of its next turn. This spell's damage increases by 1d4 when you reach 5th level (2d4), 11th level (3d4), and 17th level (4d4).</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.BARD],
  components: [SPELL_COMPONENT.VERBAL],
  magicSchoolId: schoolId('ENCHANTMENT'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x211, 1),
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.WISDOM
        },
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x212, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('PSYCHIC'),
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
                levels: [
                  {
                    id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 2),
                    level: 1,
                    order: 1,
                    diceConfig: '1d4'
                  },
                  {
                    id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 3),
                    level: 5,
                    order: 2,
                    diceConfig: '2d4'
                  },
                  {
                    id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 4),
                    level: 11,
                    order: 3,
                    diceConfig: '3d4'
                  },
                  {
                    id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 5),
                    level: 17,
                    order: 4,
                    diceConfig: '4d4'
                  }
                ]
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 1),
          order: 2,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 2),
              durationKind: DURATION_KIND.ROUND,
              amount: 1
            },
            lifecycle: {
              turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' },
              endTriggers: [
                { event: 'LIFECYCLE' as const, timing: 'CONSUME' as const, code: 'ON_ATTACK_ROLL' }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 3),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 1
                    },
                    {
                      id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 4),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 2
                    },
                    {
                      id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 5),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.SPELL },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 3
                    },
                    {
                      id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 6),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.UNARMED },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'DISADVANTAGE' },
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 4
                    }
                  ]
                }
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
