import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  VALUE_DOMAIN_CODE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_BASIC_ACTION_IDS } from '../basicActions.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
import { ABILITY_CODE } from '../vocabulary.js'

const grant = {
  grantKind: GRANT_KIND.MODIFIER_GRANT,
  domain: {},
  scope: MODIFIER_SCOPE_KIND.GLOBAL,
  selectionKind: AUTHORING_SELECTION_KIND.GRANTED
} as const

export const haste: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.HASTE,
  label: 'Haste',
  description:
    "<p>Choose a willing creature that you can see within range. Until the spell ends, the target's speed is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws, and it gains an additional action on each of its turns. That action can be used only to take the Attack (one weapon attack only), Dash, Disengage, Hide, or Use an Object action. When the spell ends, the target can't move or take actions until after its next turn, as a wave of lethargy sweeps over it.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a shaving of licorice root',
  magicSchoolId: schoolId('TRANSMUTATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.HASTE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.HASTE, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.WILLING
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.HASTE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.HASTE, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.HASTE, 0x213, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 1
            },
            // The wave of lethargy: whenever the spell ends, the target can't move or take actions
            // until after its next turn.
            lifecycle: {
              // The additional action: one use a turn, for a weapon attack or one of these actions.
              grantedActions: [
                {
                  activation: ACTIVATION_CODE.FREE,
                  usesPerTurn: 1,
                  weaponAttack: true,
                  actionDefinitionIds: [
                    SRD_BASIC_ACTION_IDS.DASH,
                    SRD_BASIC_ACTION_IDS.DISENGAGE,
                    SRD_BASIC_ACTION_IDS.HIDE,
                    SRD_BASIC_ACTION_IDS.USE_AN_OBJECT
                  ]
                }
              ],
              onEnd: {
                turns: 1,
                modifiers: [
                  {
                    ...grant,
                    id: spellChildId(SPELL_IDS.HASTE, 0x215, 1),
                    valueDomainCode: VALUE_DOMAIN_CODE.SPEED,
                    modifierKind: MODIFIER_KIND.MULTIPLY,
                    payload: { numerator: 0, denominator: 1 },
                    order: 1
                  },
                  ...[
                    VALUE_DOMAIN_CODE.ACTION_COUNT,
                    VALUE_DOMAIN_CODE.BONUS_ACTION_COUNT,
                    VALUE_DOMAIN_CODE.REACTION_COUNT
                  ].map((valueDomainCode, index) => ({
                    ...grant,
                    id: spellChildId(SPELL_IDS.HASTE, 0x215, index + 2),
                    valueDomainCode,
                    modifierKind: MODIFIER_KIND.SET_VALUE,
                    payload: { amount: 0 },
                    order: index + 2
                  }))
                ]
              }
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.HASTE, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      ...grant,
                      id: spellChildId(SPELL_IDS.HASTE, 0x214, 1),
                      valueDomainCode: VALUE_DOMAIN_CODE.SPEED,
                      modifierKind: MODIFIER_KIND.MULTIPLY,
                      payload: { numerator: 2, denominator: 1 },
                      order: 1
                    },
                    {
                      ...grant,
                      id: spellChildId(SPELL_IDS.HASTE, 0x214, 2),
                      valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                      modifierKind: MODIFIER_KIND.BONUS,
                      payload: { valueKind: 'FIXED', amount: 2 },
                      order: 2
                    },
                    {
                      ...grant,
                      id: spellChildId(SPELL_IDS.HASTE, 0x214, 3),
                      valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
                      domain: { ability: ABILITY_CODE.DEXTERITY },
                      modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                      payload: { influence: 'ADVANTAGE' },
                      order: 3
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
