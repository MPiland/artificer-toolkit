import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const shieldOfFaith: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SHIELD_OF_FAITH,
  label: 'Shield of Faith',
  description:
    'A shimmering field appears and surrounds a creature of your choice within range, granting it a +2 bonus to AC for the duration.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.PALADIN],
  magicSchoolId: schoolId('ABJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.BONUS_ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: 'FEET'
        },
        targeting: {
          selectionKind: 'SINGLE_TARGET',
          detail: 'A creature of your choice within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x213, 1),
            durationKind: 'MINUTE',
            amount: 10
          },
          effectKind: EFFECT_KIND.APPLY_GRANT,
          grants: {
            modifiers: [
              {
                id: spellChildId(SPELL_IDS.SHIELD_OF_FAITH, 0x214, 1),
                grantKind: GRANT_KIND.MODIFIER_GRANT,
                valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                domain: {},
                modifierKind: MODIFIER_KIND.BONUS,
                scope: MODIFIER_SCOPE_KIND.GLOBAL,
                selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                payload: {
                  valueKind: 'FIXED',
                  amount: 2
                },
                order: 1
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
