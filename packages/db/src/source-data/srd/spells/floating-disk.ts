import { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, CASTING_TIME_UNIT_CODE, DURATION_KIND, EFFECT_KIND, MANIFEST_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SHAPE_KIND, SPELL_ATTRIBUTE, SUBJECT, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, TRIGGER, SPELL_COMPONENT, type SpellAuthored } from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const floatingDisk: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.FLOATING_DISK,
  label: 'Floating Disk',
  description: 'This spell creates a circular plane of force that floats above the ground in an unoccupied space you can see. The disk can carry up to 500 pounds and follows you while you remain close enough.',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 1,
  classIds: [CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: "a drop of mercury",
  magicSchoolId: schoolId('CONJURATION'),
  attributes: [SPELL_ATTRIBUTE.RITUAL],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  effects: [
    {
      id: spellChildId(SPELL_IDS.FLOATING_DISK, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.FLOATING_DISK, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: {
          id: spellChildId(SPELL_IDS.FLOATING_DISK, 0x212, 1),
          shapeKind: SHAPE_KIND.CIRCLE,
          radius: {
            amount: 18,
            unit: MEASUREMENT_UNIT_CODE.INCHES
          }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.FLOATING_DISK, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.FLOATING_DISK, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.FLOATING_DISK, 0x214, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.FLOATING_DISK, 0x213, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.OBJECT
              }
            ]
          }
        }
      ]
    }
  ]
}
