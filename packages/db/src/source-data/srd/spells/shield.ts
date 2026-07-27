import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SUBJECT,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const shield: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SHIELD,
  label: 'Shield',
  description:
    'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a bonus to AC and take no damage from magic missile.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('ABJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SHIELD, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.REACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SHIELD, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: 'SELF'
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SHIELD, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SHIELD, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SHIELD, 0x213, 1),
              durationKind: 'ROUND',
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SHIELD, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.SHIELD, 0x214, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                      domain: {},
                      modifierKind: MODIFIER_KIND.BONUS,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: {
                        valueKind: 'FIXED',
                        amount: 5
                      },
                      order: 1
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
