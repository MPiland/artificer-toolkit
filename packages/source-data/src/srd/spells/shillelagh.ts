import {
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  DAMAGE_DEFENSE_BYPASS_CODE,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  SPELLCASTING_ABILITY_REFERENCE,
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { club } from '../equipment/club.js'
import { quarterstaff } from '../equipment/quarterstaff.js'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const shillelagh: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SHILLELAGH,
  label: 'Shillelagh',
  description:
    "<p>The wood of a club or quarterstaff you are holding is imbued with nature's power. For the duration, you can use your spellcasting ability instead of Strength for the attack and damage rolls of melee attacks using that weapon, and the weapon's damage die becomes a d8. The weapon also becomes magical, if it isn't already. The spell ends if you cast it again or if you let go of the weapon.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'mistletoe, a shamrock leaf, and a club or quarterstaff',
  magicSchoolId: schoolId('TRANSMUTATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SHILLELAGH, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.BONUS_ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SHILLELAGH, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SHILLELAGH, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          chosenItem: { equipmentIds: [club.id, quarterstaff.id] },
          resultBlock: {
            id: spellChildId(SPELL_IDS.SHILLELAGH, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SHILLELAGH, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            lifecycle: {
              endTriggers: [
                {
                  event: 'LIFECYCLE' as const,
                  timing: 'END' as const,
                  code: 'ON_CHOSEN_ITEM_RELEASED'
                }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SHILLELAGH, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                bindsChosenItem: true,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.SHILLELAGH, 0x214, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
                      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
                      scope: MODIFIER_SCOPE_KIND.SOURCE,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { abilities: [SPELLCASTING_ABILITY_REFERENCE] },
                      order: 1
                    },
                    {
                      id: spellChildId(SPELL_IDS.SHILLELAGH, 0x214, 2),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
                      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
                      scope: MODIFIER_SCOPE_KIND.SOURCE,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { abilities: [SPELLCASTING_ABILITY_REFERENCE] },
                      order: 2
                    },
                    {
                      id: spellChildId(SPELL_IDS.SHILLELAGH, 0x214, 3),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.WEAPON_DAMAGE_DIE,
                      domain: {},
                      modifierKind: MODIFIER_KIND.SET_VALUE,
                      scope: MODIFIER_SCOPE_KIND.SOURCE,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { amount: 8 },
                      order: 3
                    },
                    {
                      id: spellChildId(SPELL_IDS.SHILLELAGH, 0x214, 4),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_TRAIT,
                      domain: { trait: DAMAGE_DEFENSE_BYPASS_CODE.MAGICAL },
                      modifierKind: MODIFIER_KIND.ENABLE,
                      scope: MODIFIER_SCOPE_KIND.SOURCE,
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
