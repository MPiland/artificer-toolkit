import {
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  CASTING_TIME_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
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
export const guidingBolt: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.GUIDING_BOLT,
  label: 'Guiding Bolt',
  description:
    '<p>A flash of light streaks toward a creature of your choice within range. Make a ranged spell attack against the target. On a hit, the target takes 4d6 radiant damage, and the next attack roll made against this target before the end of your next turn has advantage, thanks to the mystical dim light glittering on the target until then. At Higher Levels. When you cast this spell using a spell slot of 2nd level or higher, the damage increases by 1d6 for each slot level above 1st.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.CLERIC],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.RANGED_SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('RADIANT'),
                valueKind: 'DICE',
                scalingKind: SCALING.PER_LEVEL,
                scalingSource: SCALING_SOURCE.SPELL_CAST_LEVEL,
                levels: [
                  {
                    id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 2),
                    level: 1,
                    order: 1,
                    diceConfig: '4d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 3),
                    level: 2,
                    order: 2,
                    diceConfig: '5d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 4),
                    level: 3,
                    order: 3,
                    diceConfig: '6d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 5),
                    level: 4,
                    order: 4,
                    diceConfig: '7d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 6),
                    level: 5,
                    order: 5,
                    diceConfig: '8d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 7),
                    level: 6,
                    order: 6,
                    diceConfig: '9d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 8),
                    level: 7,
                    order: 7,
                    diceConfig: '10d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 9),
                    level: 8,
                    order: 8,
                    diceConfig: '11d6'
                  },
                  {
                    id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x212, 10),
                    level: 9,
                    order: 9,
                    diceConfig: '12d6'
                  }
                ]
              }
            ]
          }
        },
        {
          id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x213, 1),
          order: 2,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x213, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            // The next attack roll against the target, before the end of the caster's next turn.
            duration: {
              id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x214, 1),
              durationKind: DURATION_KIND.ROUND,
              amount: 1
            },
            lifecycle: {
              turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' },
              endTriggers: [
                { event: 'LIFECYCLE' as const, timing: 'CONSUME' as const, code: 'ON_ATTACKED' }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x213, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: Object.values(ATTACK_DOMAIN_CODE).map((attackDomain, index) => ({
                    id: spellChildId(SPELL_IDS.GUIDING_BOLT, 0x215, index + 1),
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
