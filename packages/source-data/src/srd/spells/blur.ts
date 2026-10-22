import {
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
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
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_BLINDSIGHT_SENSE_ID, SRD_TRUESIGHT_SENSE_ID } from '../vocabulary.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
// Attacks against the caster have disadvantage, except from an attacker that sees it by
// Blindsight (doesn't rely on sight) or Truesight (sees through illusions).
const blurModifiers = Object.values(ATTACK_DOMAIN_CODE).map((attackDomain, index) => ({
  id: spellChildId(SPELL_IDS.BLUR, 0x214, index + 1),
  order: index + 1,
  grantKind: GRANT_KIND.MODIFIER_GRANT,
  scope: MODIFIER_SCOPE_KIND.GLOBAL,
  selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
  valueDomainCode: VALUE_DOMAIN_CODE.ATTACKS_AGAINST,
  domain: {
    attackDomain,
    requiresHolderSeesAttacker: false,
    exemptAttackerSenseDefinitionIds: [SRD_BLINDSIGHT_SENSE_ID, SRD_TRUESIGHT_SENSE_ID]
  },
  modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
  payload: { influence: 'DISADVANTAGE' }
}))
export const blur: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.BLUR,
  label: 'Blur',
  description:
    "<p>Your body becomes blurred, shifting and wavering to all who can see you. For the duration, any creature has disadvantage on attack rolls against you. An attacker is immune to this effect if it doesn't rely on sight, as with blindsight, or can see through illusions, as with truesight.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL],
  magicSchoolId: schoolId('ILLUSION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.BLUR, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.BLUR, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.BLUR, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.BLUR, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.BLUR, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.BLUR, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: { modifiers: blurModifiers }
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
