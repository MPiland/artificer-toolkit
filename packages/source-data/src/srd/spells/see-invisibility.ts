import {
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  RANGE_KIND,
  SCALING,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_SEE_INVISIBILITY_SENSE_ID } from '../vocabulary.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const seeInvisibility: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SEE_INVISIBILITY,
  label: 'See Invisibility',
  description:
    '<p>For the duration, you see invisible creatures and objects as if they were visible, and you can see into the Ethereal Plane. Ethereal creatures and objects appear ghostly and translucent.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a pinch of talc and a small sprinkling of powdered silver',
  magicSchoolId: schoolId('DIVINATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SEE_INVISIBILITY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SEE_INVISIBILITY, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SEE_INVISIBILITY, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SEE_INVISIBILITY, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SEE_INVISIBILITY, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SEE_INVISIBILITY, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  senses: [
                    {
                      id: spellChildId(SPELL_IDS.SEE_INVISIBILITY, 0x214, 1),
                      grantKind: GRANT_KIND.SENSE_GRANT,
                      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                      scalingKind: SCALING.NONE,
                      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                      senseIds: [SRD_SEE_INVISIBILITY_SENSE_ID],
                      range: {
                        id: spellChildId(SPELL_IDS.SEE_INVISIBILITY, 0x215, 1),
                        rangeKind: RANGE_KIND.UNLIMITED
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
