import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  RANGE_KIND,
  SUBJECT,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const revivify: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.REVIVIFY,
  label: 'Revivify',
  description:
    "<p>You touch a creature that has died within the last minute. That creature returns to life with 1 hit point. This spell can't return to life a creature that has died of old age, nor can it restore any missing body parts.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.PALADIN],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'diamonds worth 300 gp, which the spell consumes',
  magicSchoolId: schoolId('NECROMANCY'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.REVIVIFY, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.REVIVIFY, 0x211, 1),
          rangeKind: RANGE_KIND.TOUCH
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.REVIVIFY, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.REVIVIFY, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.REVIVIFY, 0x2f0, 1),
                effectKind: EFFECT_KIND.REVIVE,
                hitPoints: 'ONE' as const
              },
              {
                id: spellChildId(SPELL_IDS.REVIVIFY, 0x212, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Check Revival Eligibility',
                reasonCode: 'EXTERNAL_WORLD_STATE' as const,
                instructions:
                  'This spell can\u0027t return to life a creature that has died of old age, nor can it restore any missing body parts.'
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
