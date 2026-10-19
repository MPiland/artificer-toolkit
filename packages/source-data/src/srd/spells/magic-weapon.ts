import {
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  DAMAGE_DEFENSE_BYPASS_CODE,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
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
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const magicWeapon: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.MAGIC_WEAPON,
  label: 'Magic Weapon',
  description:
    '<p>You touch a nonmagical weapon. Until the spell ends, that weapon becomes a magic weapon with a +1 bonus to attack rolls and damage rolls. At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the bonus increases to +2. When you use a spell slot of 6th level or higher, the bonus increases to +3.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.PALADIN, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('TRANSMUTATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.MAGIC_WEAPON, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.MAGIC_WEAPON, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.MAGIC_WEAPON, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          chosenItem: {
            category: EQUIPMENT_CATEGORY_CODE.WEAPON,
            excludedProperties: [EQUIPMENT_PROPERTY_CODE.MAGIC]
          },
          resultBlock: {
            id: spellChildId(SPELL_IDS.MAGIC_WEAPON, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.MAGIC_WEAPON, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.MAGIC_WEAPON, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                bindsChosenItem: true,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.MAGIC_WEAPON, 0x214, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
                      modifierKind: MODIFIER_KIND.BONUS,
                      scope: MODIFIER_SCOPE_KIND.SOURCE,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { valueKind: 'SPELL_SLOT_LEVEL', levelsPerStep: 2, maximum: 3 },
                      order: 1
                    },
                    {
                      id: spellChildId(SPELL_IDS.MAGIC_WEAPON, 0x214, 2),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
                      modifierKind: MODIFIER_KIND.BONUS,
                      scope: MODIFIER_SCOPE_KIND.SOURCE,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { valueKind: 'SPELL_SLOT_LEVEL', levelsPerStep: 2, maximum: 3 },
                      order: 2
                    },
                    {
                      id: spellChildId(SPELL_IDS.MAGIC_WEAPON, 0x214, 3),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
                      modifierKind: MODIFIER_KIND.BONUS,
                      scope: MODIFIER_SCOPE_KIND.SOURCE,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { valueKind: 'SPELL_SLOT_LEVEL', levelsPerStep: 2, maximum: 3 },
                      order: 3
                    },
                    {
                      id: spellChildId(SPELL_IDS.MAGIC_WEAPON, 0x214, 4),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
                      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
                      modifierKind: MODIFIER_KIND.BONUS,
                      scope: MODIFIER_SCOPE_KIND.SOURCE,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { valueKind: 'SPELL_SLOT_LEVEL', levelsPerStep: 2, maximum: 3 },
                      order: 4
                    },
                    {
                      id: spellChildId(SPELL_IDS.MAGIC_WEAPON, 0x214, 5),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_TRAIT,
                      domain: { trait: DAMAGE_DEFENSE_BYPASS_CODE.MAGICAL },
                      modifierKind: MODIFIER_KIND.ENABLE,
                      scope: MODIFIER_SCOPE_KIND.SOURCE,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 5
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
