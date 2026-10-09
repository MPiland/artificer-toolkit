import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  CASTING_TIME_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  SUBJECT,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const shockingGrasp: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SHOCKING_GRASP,
  label: 'Shocking Grasp',
  description:
    "<p>Lightning springs from your hand to deliver a shock to a creature you try to touch. Make a melee spell attack against the target. You have advantage on the attack roll if the target is wearing armor made of metal. On a hit, the target takes 1d8 lightning damage, and it can't take reactions until the start of its next turn. The spell's damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('LIGHTNING'),
                valueKind: 'DICE',
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
                levels: [
                  {
                    id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 2),
                    level: 1,
                    order: 1,
                    diceConfig: '1d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 3),
                    level: 5,
                    order: 2,
                    diceConfig: '2d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 4),
                    level: 11,
                    order: 3,
                    diceConfig: '3d8'
                  },
                  {
                    id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x212, 5),
                    level: 17,
                    order: 4,
                    diceConfig: '4d8'
                  }
                ]
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x213, 1),
          order: 2,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x213, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x214, 1),
              durationKind: DURATION_KIND.ROUND,
              amount: 1
            },
            lifecycle: { turnAnchor: { actor: 'TARGET', boundary: 'START_OF_TURN' } },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x213, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: [
                    {
                      id: spellChildId(SPELL_IDS.SHOCKING_GRASP, 0x215, 1),
                      grantKind: GRANT_KIND.MODIFIER_GRANT,
                      valueDomainCode: VALUE_DOMAIN_CODE.REACTION_COUNT,
                      domain: {},
                      modifierKind: MODIFIER_KIND.SET_VALUE,
                      scope: MODIFIER_SCOPE_KIND.GLOBAL,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      payload: {
                        amount: 0
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
