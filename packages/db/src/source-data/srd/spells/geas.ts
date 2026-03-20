import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SRD_MAGIC_SCHOOLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
import { spellChildId } from './shared.js'

function schoolId(code: string): string {
  const entry = SRD_MAGIC_SCHOOLS.find((s) => s.code === code)
  if (!entry) throw new Error(`SRD magic school vocabulary entry for ${code} required for spell source data.`)
  return entry.id
}

export const geas: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.GEAS,
  label: "Geas",
  description: "You place a magical command on a creature that you can see within range, forcing it to carry out some service or refrain from some action or course of activity as you decide. If the creature can understand you, it must succeed on a Wisdom saving throw or become charmed by you for the duration.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.PALADIN, CLASS_IDS.WIZARD],
  magicSchoolId: schoolId('ENCHANTMENT'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.GEAS, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.GEAS, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 60,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Choose one creature within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.GEAS, 0x212, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.GEAS, 0x213, 1),
            durationKind: DURATION_KIND.DAY,
            amount: 30
          },
          effectKind: EFFECT_KIND.RULE,
          label: 'Geas',
          description:
            'The current model does not yet honestly express a long-term magical command with the full compelled-service and penalty behavior.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
}
