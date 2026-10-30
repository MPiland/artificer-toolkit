import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  RANGE_KIND,
  SCALING,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { spellChildId } from './shared.js'
function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry)
    throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}
const EAT_EFFECT_KEY = 0x220
const EAT_EFFECT_ID = spellChildId(SPELL_IDS.GOODBERRY, EAT_EFFECT_KEY, 1)
const EAT_PATH_KEY = 0x222

export const goodberry: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.GOODBERRY,
  label: 'Goodberry',
  description:
    '<p>Up to ten berries appear in your hand and are infused with magic for the duration. A creature can use its action to eat one berry. Eating a berry restores 1 hit point, and the berry provides enough nourishment to sustain a creature for one day. The berries lose their potency if they have not been consumed within 24 hours of the casting of this spell.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.RANGER],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a sprig of mistletoe',
  magicSchoolId: schoolId('TRANSMUTATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.GOODBERRY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.GOODBERRY, 0x211, 1),
          rangeKind: RANGE_KIND.SELF
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SELF
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.GOODBERRY, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.GOODBERRY, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.GOODBERRY, 0x213, 1),
              durationKind: DURATION_KIND.DAY,
              amount: 1
            },
            // The ten berries: each one fed as an action heals 1 hit point and spends a use.
            lifecycle: {
              uses: 10,
              effectOffers: [
                {
                  kind: 'REPEAT_SOURCE_PATH' as const,
                  offeredTo: 'SOURCE' as const,
                  activation: ACTIVATION_CODE.ACTION,
                  effectId: EAT_EFFECT_ID,
                  target: 'INVOCATION' as const
                }
              ]
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.GOODBERRY, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {}
              }
            ]
          }
        }
      ]
    },
    {
      id: EAT_EFFECT_ID,
      order: 2,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.GOODBERRY, EAT_EFFECT_KEY + 1, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.GOODBERRY, EAT_PATH_KEY, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.GOODBERRY, EAT_PATH_KEY, 1) + '__result',
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.GOODBERRY, EAT_PATH_KEY, 2),
                effectKind: EFFECT_KIND.HEAL,
                valueKind: 'FIXED',
                scalingKind: SCALING.NONE,
                amount: 1
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
