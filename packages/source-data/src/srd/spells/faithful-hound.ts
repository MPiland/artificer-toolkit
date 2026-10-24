import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SIZE_CODE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const faithfulHound: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FAITHFUL_HOUND,
  label: 'Faithful Hound',
  description:
    "<p>You conjure a phantom watchdog in an unoccupied space that you can see within range, where it remains for the duration, until you dismiss it as an action, or until you move more than 100 feet away from it. The hound is invisible to all creatures except you and can't be harmed. When a Small or larger creature comes within 30 feet of it without first speaking the password that you specify when you cast this spell, the hound starts barking loudly. The hound sees invisible creatures and can see into the Ethereal Plane. It ignores illusions. At the start of each of your turns, the hound attempts to bite one creature within 5 feet of it that is hostile to you. The hound's attack bonus is equal to your spellcasting ability modifier + your proficiency bonus. On a hit, it deals 4d8 piercing damage.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 4,
  classIds: [CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a tiny silver whistle, a piece of bone, and a thread',
  magicSchoolId: schoolId('CONJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SEQUENTIAL,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 8
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x214, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.SUMMON,
                label: 'Faithful Hound',
                // The SRD names no size; the hound is drawn in one 5-foot square and never moves.
                statBlock: { size: SIZE_CODE.MEDIUM, damageabilityKind: 'INVULNERABLE' }
              },
              {
                id: spellChildId(SPELL_IDS.FAITHFUL_HOUND, 0x215, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Faithful Hound',
                reasonCode: 'GM_CHOICE' as const,
                instructions:
                  'The hound is invisible to all creatures except you, sees invisible creatures and into the Ethereal Plane, and ignores illusions. When a Small or larger creature comes within 30 feet of it without first speaking the password you specified, the hound barks loudly. At the start of each of your turns, it attempts to bite one creature within 5 feet of it that is hostile to you: its attack bonus is your spellcasting ability modifier + your proficiency bonus, and on a hit it deals 4d8 piercing damage. The spell ends early if you dismiss the hound as an action or move more than 100 feet away from it.'
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
