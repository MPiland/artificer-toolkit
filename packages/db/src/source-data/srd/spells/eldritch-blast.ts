import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SCALING_SOURCE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const eldritchBlast: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.ELDRITCH_BLAST,
  label: 'Eldritch Blast',
  description:
    'You hurl a beam of crackling energy at a creature within range. Make a ranged spell attack against the target, dealing 1d10 force damage on a hit.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 0,
  classIds: [CLASS_IDS.WARLOCK],
  magicSchoolId: schoolId('EVOCATION'),
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.ELDRITCH_BLAST, 0x210, 1),
      order: 1,
      invocation: {
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
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          detail: 'Make a ranged spell attack against one creature within range.'
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.ELDRITCH_BLAST, 0x212, 1),
          branch: BRANCH.ON_HIT,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Eldritch Blast',
          description:
            'On a hit, the target takes force damage. The cantrip may create additional beams as the caster advances, but that beam-count logic is not yet modeled structurally here.'
        },
        {
          id: spellChildId(SPELL_IDS.ELDRITCH_BLAST, 0x213, 1),
          branch: BRANCH.ON_MISS,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          effectKind: EFFECT_KIND.RULE,
          label: 'Miss',
          description: 'On a miss, the beam fails to deal damage.'
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
