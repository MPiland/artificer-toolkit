import {
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
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
import { ABILITY_CODE } from '../vocabulary.js'
const grantId = (index: number) => spellChildId(SPELL_IDS.FORESIGHT, 0x214, index + 1)
const grant = {
  grantKind: GRANT_KIND.MODIFIER_GRANT,
  scope: MODIFIER_SCOPE_KIND.GLOBAL,
  selectionKind: AUTHORING_SELECTION_KIND.GRANTED
} as const
const attackDomains = Object.values(ATTACK_DOMAIN_CODE)
// Advantage on attack rolls, ability checks and every saving throw; attacks against the target
// have disadvantage. "Can't be surprised" resolves nothing in an Encounter (D156).
const foresightModifiers = [
  ...attackDomains.map((attackDomain) => ({
    ...grant,
    valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
    domain: { attackDomain },
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'ADVANTAGE' }
  })),
  {
    ...grant,
    valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_CHECK,
    domain: {},
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'ADVANTAGE' }
  },
  ...Object.values(ABILITY_CODE).map((ability) => ({
    ...grant,
    valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
    domain: { ability },
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'ADVANTAGE' }
  })),
  ...attackDomains.map((attackDomain) => ({
    ...grant,
    valueDomainCode: VALUE_DOMAIN_CODE.ATTACKS_AGAINST,
    domain: { attackDomain, requiresHolderSeesAttacker: false },
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'DISADVANTAGE' }
  }))
].map((modifier, index) => ({ id: grantId(index), ...modifier, order: index + 1 }))
export const foresight: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FORESIGHT,
  label: 'Foresight',
  description:
    "<p>You touch a willing creature and bestow a limited ability to see into the immediate future. For the duration, the target can't be surprised and has advantage on attack rolls, ability checks, and saving throws. Additionally, other creatures have disadvantage on attack rolls against the target for the duration. This spell immediately ends if you cast it again before its duration ends.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  level: 9,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a hummingbird feather',
  magicSchoolId: schoolId('DIVINATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.FORESIGHT, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FORESIGHT, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.FORESIGHT, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.FORESIGHT, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.FORESIGHT, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 8
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.FORESIGHT, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: { modifiers: foresightModifiers }
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
