import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALABLE_SCALING_KIND,
  SCALING_SOURCE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const eldritchBlast: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ELDRITCH_BLAST,
  label: 'Eldritch Blast',
  description:
    "<p>A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage. The spell creates more than one beam when you reach higher levels: two beams at 5th level, three beams at 11th level, and four beams at 17th level. You can direct the beams at the same target or at different ones. Make a separate attack roll for each beam.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.WARLOCK],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.ELDRITCH_BLAST, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.SPELL_ATTACK,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.ELDRITCH_BLAST, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY,
          maxTargetsScaling: {
            scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
            scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
            breakpoints: [1, 5, 11, 17].map((level, index) => ({
              id: spellChildId(SPELL_IDS.ELDRITCH_BLAST, 0x214, index + 1),
              level,
              order: index + 1,
              value: { amount: index + 1 }
            }))
          },
          resolutionCountScaling: {
            scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
            scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
            breakpoints: [1, 5, 11, 17].map((level, index) => ({
              id: spellChildId(SPELL_IDS.ELDRITCH_BLAST, 0x215, index + 1),
              level,
              order: index + 1,
              value: { amount: index + 1 }
            }))
          },
          allowRepeatedTargets: true
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.ELDRITCH_BLAST, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.ELDRITCH_BLAST, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.ELDRITCH_BLAST, 0x212, 1),
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: damageTypeId('FORCE'),
                valueKind: 'DICE',
                scalingKind: SCALABLE_SCALING_KIND.BREAKPOINTS,
                scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
                breakpoints: [1, 5, 11, 17].map((level, index) => ({
                  id: spellChildId(SPELL_IDS.ELDRITCH_BLAST, 0x216, index + 1),
                  level,
                  order: index + 1,
                  value: { diceConfig: '1d10' }
                }))
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
