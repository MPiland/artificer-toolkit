import {
  ACTIVATION_CODE,
  BRANCH,
  BRANCH_GROUP_TYPE,
  BRANCH_RESOLUTION_KIND,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const insectPlague: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.INSECT_PLAGUE,
  label: 'Insect Plague',
  description:
    "Swarming, biting locusts fill a 20-foot-radius sphere centered on a point you choose within range. The sphere spreads around corners. The sphere remains for the duration, and its area is lightly obscured. The sphere's area is difficult terrain.",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.CLERIC, CLASS_IDS.DRUID, CLASS_IDS.SORCERER],
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  capabilities: [
    {
      id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 300,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          detail: 'Choose a point within range. Swarming insects fill a 20-foot-radius sphere there.'
        },
        shape: {
          id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x212, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 20,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      branches: [
        {
          id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x213, 1),
          branch: BRANCH.ON_USE,
          groupType: BRANCH_GROUP_TYPE.SINGLE,
          resolutionKind: BRANCH_RESOLUTION_KIND.DIRECT,
          duration: {
            id: spellChildId(SPELL_IDS.INSECT_PLAGUE, 0x214, 1),
            durationKind: DURATION_KIND.MINUTE,
            amount: 10
          },
          effectKind: EFFECT_KIND.MANIFEST,
          manifestKind: MANIFEST_KIND.ZONE,
          label: 'Insect Plague',
          detail:
            "Creates a swarm-filled hazardous zone that obscures the area, counts as difficult terrain, and harms creatures within it under the spell's rules."
        }
      ]
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID
}
