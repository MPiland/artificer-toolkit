import {
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  SPELL_ATTRIBUTE,
  VALUE_DOMAIN_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
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
export const trueStrike: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.TRUE_STRIKE,
  label: 'True Strike',
  description:
    "<p>You extend your hand and point a finger at a target in range. Your magic grants you a brief insight into the target's defenses. On your next turn, you gain advantage on your first attack roll against the target, provided that this spell hasn't ended.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WARLOCK, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('DIVINATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  effects: [
    {
      id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x211, 1),
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
          id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x213, 1),
              durationKind: DURATION_KIND.ROUND,
              amount: 1
            },
            // The target holds the advantage for the caster's next turn: counted on the caster's
            // turns, dormant until that turn, met only by the caster's attacks, and used up by the
            // first of them.
            lifecycle: {
              turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' },
              endTriggers: [
                { event: 'LIFECYCLE' as const, timing: 'CONSUME' as const, code: 'ON_ATTACKED' }
              ],
              fromSourceOnly: true,
              activeOnlyOnFinalAnchorTurn: true
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: Object.values(ATTACK_DOMAIN_CODE).map((attackDomain, index) => ({
                    id: spellChildId(SPELL_IDS.TRUE_STRIKE, 0x214, index + 1),
                    grantKind: GRANT_KIND.MODIFIER_GRANT,
                    valueDomainCode: VALUE_DOMAIN_CODE.ATTACKS_AGAINST,
                    domain: { attackDomain, requiresHolderSeesAttacker: false },
                    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
                    payload: { influence: 'ADVANTAGE' },
                    scope: MODIFIER_SCOPE_KIND.GLOBAL,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    order: index + 1
                  }))
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
