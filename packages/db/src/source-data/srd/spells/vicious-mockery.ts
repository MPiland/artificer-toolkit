import {
  ATTACK_DOMAIN_CODE,
  ABILITY_CODE,
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
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
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const viciousMockery: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.VICIOUS_MOCKERY,
  label: 'Vicious Mockery',
  description:
    'You unleash a string of insults laced with subtle enchantments at a creature you can see within range. If the target can hear you, it takes psychic damage on a failed Wisdom save and has disadvantage on its next attack roll before the end of its next turn.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.BARD],
  magicSchoolId: schoolId('ENCHANTMENT'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x211, 1),
          savingThrowKind: 'SOURCE_SAVE_DC',
          ability: ABILITY_CODE.WISDOM
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
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SEQUENTIAL,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId('PSYCHIC'),
          valueKind: DAMAGE_VALUE_KIND.DICE,
          scalingKind: SCALING.PER_LEVEL,
          scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
          levels: [
            { id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 2), level: 1, order: 1, diceConfig: '1d4' },
            { id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 3), level: 5, order: 2, diceConfig: '2d4' },
            { id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 4), level: 11, order: 3, diceConfig: '3d4' },
            { id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x213, 5), level: 17, order: 4, diceConfig: '4d4' }
          ]
        },
        {
          id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 1),
          branch: BRANCH.ON_SAVE_FAIL,
          groupType: BRANCH_GROUP_TYPE.SEQUENTIAL,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 2),
            durationKind: DURATION_KIND.ROUND,
            amount: 1
          },
          lifecycle: {
            consumeOnFirstEvent: 'ON_ATTACK_ROLL'
          },
          effectKind: EFFECT_KIND.APPLY_GRANT,
          grants: {
            modifiers: [
              {
                id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 3),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL_BONUS,
                domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
                modifierKind: MODIFIER_KIND.DISADVANTAGE,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                order: 1
              },
              {
                id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 4),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL_BONUS,
                domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
                modifierKind: MODIFIER_KIND.DISADVANTAGE,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                order: 2
              },
              {
                id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 5),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL_BONUS,
                domain: { attackDomain: ATTACK_DOMAIN_CODE.SPELL },
                modifierKind: MODIFIER_KIND.DISADVANTAGE,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                order: 3
              },
              {
                id: spellChildId(SPELL_IDS.VICIOUS_MOCKERY, 0x214, 6),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL_BONUS,
                domain: { attackDomain: ATTACK_DOMAIN_CODE.UNARMED },
                modifierKind: MODIFIER_KIND.DISADVANTAGE,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                order: 4
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
