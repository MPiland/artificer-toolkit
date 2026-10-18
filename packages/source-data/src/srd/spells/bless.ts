import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  ROLLED_DIE_SIGN,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const bless: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.BLESS,
  label: 'Bless',
  description:
    '<p>You bless up to three creatures of your choice within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw. At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, you can target one additional creature for each slot level above 1st.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.PALADIN],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a sprinkling of holy water',
  magicSchoolId: schoolId('ENCHANTMENT'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.BLESS, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.BLESS, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY,
          maxTargets: 3
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.BLESS, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.BLESS, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.BLESS, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.BLESS, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.BLESS, 0x215, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                      order: 1
                    },
                    {
                      id: spellChildId(SPELL_IDS.BLESS, 0x215, 2),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                      order: 2
                    },
                    {
                      id: spellChildId(SPELL_IDS.BLESS, 0x215, 3),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.SPELL },
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                      order: 3
                    },
                    {
                      id: spellChildId(SPELL_IDS.BLESS, 0x215, 4),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.UNARMED },
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                      order: 4
                    },
                    {
                      id: spellChildId(SPELL_IDS.BLESS, 0x215, 5),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                      domain: { ability: ABILITY_CODE.STRENGTH },
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                      order: 5
                    },
                    {
                      id: spellChildId(SPELL_IDS.BLESS, 0x215, 6),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                      domain: { ability: ABILITY_CODE.DEXTERITY },
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                      order: 6
                    },
                    {
                      id: spellChildId(SPELL_IDS.BLESS, 0x215, 7),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                      domain: { ability: ABILITY_CODE.CONSTITUTION },
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                      order: 7
                    },
                    {
                      id: spellChildId(SPELL_IDS.BLESS, 0x215, 8),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                      domain: { ability: ABILITY_CODE.INTELLIGENCE },
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                      order: 8
                    },
                    {
                      id: spellChildId(SPELL_IDS.BLESS, 0x215, 9),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                      domain: { ability: ABILITY_CODE.WISDOM },
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                      order: 9
                    },
                    {
                      id: spellChildId(SPELL_IDS.BLESS, 0x215, 10),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                      domain: { ability: ABILITY_CODE.CHARISMA },
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
                      order: 10
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
