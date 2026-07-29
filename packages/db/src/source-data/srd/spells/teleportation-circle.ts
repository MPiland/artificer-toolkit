import {
  TARGET_DISPOSITION_KIND,
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SHAPE_KIND,
  SUBJECT,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const teleportationCircle: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.TELEPORTATION_CIRCLE,
  label: 'Teleportation Circle',
  description:
    'As you cast the spell, you draw a 10-foot-diameter circle on the ground inscribed with sigils that link your location to a permanent teleportation circle of your choice whose sigil sequence you know and that is on the same plane of existence as you.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.MATERIAL],
  materialDescription:
    'rare chalks and inks infused with precious gems with 50 gp, which the spell consumes',
  magicSchoolId: schoolId('CONJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.TELEPORTATION_CIRCLE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.TELEPORTATION_CIRCLE, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 10,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: {
          id: spellChildId(SPELL_IDS.TELEPORTATION_CIRCLE, 0x212, 1),
          shapeKind: SHAPE_KIND.CIRCLE,
          radius: {
            amount: 5,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        },
        targeting: {
          selectionKind: 'AREA_CONTENTS',
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.TELEPORTATION_CIRCLE, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.TELEPORTATION_CIRCLE, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.TELEPORTATION_CIRCLE, 0x214, 1),
              durationKind: 'ROUND',
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.TELEPORTATION_CIRCLE, 0x213, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE
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
