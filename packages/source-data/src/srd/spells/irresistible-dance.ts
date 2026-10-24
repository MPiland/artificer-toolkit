import {
  ABILITY_CODE,
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
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
const grantId = (index: number) => spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x216, index + 1)
const grant = {
  grantKind: GRANT_KIND.MODIFIER_GRANT,
  scope: MODIFIER_SCOPE_KIND.GLOBAL,
  selectionKind: AUTHORING_SELECTION_KIND.GRANTED
} as const
const attackDomains = Object.values(ATTACK_DOMAIN_CODE)
// The dance uses all the target's movement, gives it disadvantage on attack rolls and Dexterity
// saves, and gives other creatures advantage on attack rolls against it. The holder-action Wisdom
// save and the charm immunity are the GM ruling below (D187a).
const danceModifiers = [
  {
    ...grant,
    valueDomainCode: VALUE_DOMAIN_CODE.SPEED,
    domain: {},
    modifierKind: MODIFIER_KIND.SET_VALUE,
    payload: { amount: 0 }
  },
  ...attackDomains.map((attackDomain) => ({
    ...grant,
    valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
    domain: { attackDomain },
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'DISADVANTAGE' }
  })),
  {
    ...grant,
    valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
    domain: { ability: ABILITY_CODE.DEXTERITY },
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'DISADVANTAGE' }
  },
  ...attackDomains.map((attackDomain) => ({
    ...grant,
    valueDomainCode: VALUE_DOMAIN_CODE.ATTACKS_AGAINST,
    domain: { attackDomain, requiresHolderSeesAttacker: false },
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'ADVANTAGE' }
  }))
].map((modifier, index) => ({ id: grantId(index), ...modifier, order: index + 1 }))
export const irresistibleDance: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.IRRESISTIBLE_DANCE,
  label: 'Irresistible Dance',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  description:
    "<p>Choose one creature that you can see within range. The target begins a comic dance in place: shuffling, tapping its feet, and capering for the duration. Creatures that can't be charmed are immune to this spell. A dancing creature must use all its movement to dance without leaving its space and has disadvantage on Dexterity saving throws and attack rolls. While the target is affected by this spell, other creatures have advantage on attack rolls against it. As an action, a dancing creature makes a Wisdom saving throw to regain control of itself. On a successful save, the spell ends.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL],
  magicSchoolId: schoolId('ENCHANTMENT'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x212, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x214, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x215, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: { modifiers: danceModifiers }
              },
              {
                id: spellChildId(SPELL_IDS.IRRESISTIBLE_DANCE, 0x215, 2),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Dance rulings',
                reasonCode: 'GM_CHOICE' as const,
                instructions:
                  "A creature that can't be charmed is immune to this spell. As an action, the dancing creature makes a Wisdom saving throw against your spell save DC to regain control of itself; on a success the spell ends."
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
