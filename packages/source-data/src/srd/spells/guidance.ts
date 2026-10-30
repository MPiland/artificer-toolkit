import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  ROLLED_DIE_SIGN,
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
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const guidance: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.GUIDANCE,
  label: 'Guidance',
  description:
    '<p>You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice. It can roll the die before or after making the ability check. The spell then ends.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('DIVINATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.GUIDANCE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.GUIDANCE, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.GUIDANCE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.GUIDANCE, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.GUIDANCE, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            lifecycle: {
              endTriggers: [
                {
                  event: 'LIFECYCLE' as const,
                  timing: 'CONSUME' as const,
                  code: 'ON_ABILITY_CHECK'
                }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.GUIDANCE, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.GUIDANCE, 0x215, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_CHECK,
                      domain: {},
                      modifierKind: MODIFIER_KIND.ADD_BONUS_DIE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: { count: 1, faces: 4, sign: ROLLED_DIE_SIGN.ADD },
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
