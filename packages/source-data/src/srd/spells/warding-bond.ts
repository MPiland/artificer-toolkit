import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_DAMAGE_TYPES, ABILITY_CODE } from '../vocabulary.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
const ABILITY_COUNT = Object.values(ABILITY_CODE).length
export const wardingBond: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.WARDING_BOND,
  label: 'Warding Bond',
  description:
    '<p>This spell wards a willing creature you touch and creates a mystic connection between you and the target until the spell ends. While the target is within 60 feet of you, it gains a +1 bonus to AC and saving throws, and it has resistance to all damage. Also, each time it takes damage, you take the same amount of damage. The spell ends if you drop to 0 hit points or if you and the target become separated by more than 60 feet. It also ends if the spell is cast again on either of the connected creatures. You can also dismiss the spell as an action.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription:
    'a pair of platinum rings worth at least 50 gp each, which you and the target must wear for the duration',
  magicSchoolId: schoolId('ABJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.WARDING_BOND, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.WARDING_BOND, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.WARDING_BOND, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.WARDING_BOND, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.WARDING_BOND, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            // Separation ends the whole bond (a Character's fold has no positions to restrict one grant);
            // recasting on either creature stays description-only.
            lifecycle: {
              endTriggers: [
                { event: 'INCAPACITATED' as const, of: 'SOURCE' as const },
                { event: 'SEPARATED' as const, from: 'SOURCE' as const, beyondFeet: 60 }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.WARDING_BOND, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.WARDING_BOND, 0x214, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                      domain: {},
                      modifierKind: MODIFIER_KIND.BONUS,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { valueKind: 'FIXED', amount: 1 },
                      order: 1
                    },
                    ...Object.values(ABILITY_CODE).map((ability, index) => ({
                      id: spellChildId(SPELL_IDS.WARDING_BOND, 0x214, index + 2),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                      domain: { ability },
                      modifierKind: MODIFIER_KIND.BONUS,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { valueKind: 'FIXED' as const, amount: 1 },
                      order: 2 + index
                    })),
                    ...SRD_DAMAGE_TYPES.map(({ id }, index) => ({
                      id: spellChildId(SPELL_IDS.WARDING_BOND, 0x215, index + 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ADD_OPTION,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { damageTypeId: id },
                      order: 2 + ABILITY_COUNT + index
                    })),
                    {
                      id: spellChildId(SPELL_IDS.WARDING_BOND, 0x216, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_MIRROR,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ENABLE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      order: 2 + ABILITY_COUNT + SRD_DAMAGE_TYPES.length
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
