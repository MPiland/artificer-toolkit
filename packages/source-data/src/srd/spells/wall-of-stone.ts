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
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const wallOfStone: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.WALL_OF_STONE,
  label: 'Wall of Stone',
  description:
    "<p>A nonmagical wall of solid stone springs into existence at a point you choose within range. The wall is 6 inches thick and is composed of ten 10-foot-by-10-foot panels. Each panel must be contiguous with at least one other panel. Alternatively, you can create 10-foot-by-20-foot panels that are only 3 inches thick. If the wall cuts through a creature's space when it appears, the creature is pushed to one side of the wall (your choice). If a creature would be surrounded on all sides by the wall (or the wall and another solid surface), that creature can make a Dexterity saving throw. On a success, it can use its reaction to move up to its speed so that it is no longer enclosed by the wall. The wall can have any shape you desire, though it can't occupy the same space as a creature or object. The wall doesn't need to be vertical or rest on any firm foundation. It must, however, merge with and be solidly supported by existing stone. Thus, you can use this spell to bridge a chasm or create a ramp. If you create a span greater than 20 feet in length, you must halve the size of each panel to create supports. You can crudely shape the wall to create crenellations, battlements, and so on. The wall is an object made of stone that can be damaged and thus breached. Each panel has AC 15 and 30 hit points per inch of thickness. Reducing a panel to 0 hit points destroys it and might cause connected panels to collapse at the GM's discretion. If you maintain your concentration on this spell for its whole duration, the wall becomes permanent and can't be dispelled. Otherwise, the wall disappears when the spell ends.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 5,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.SORCERER, CLASS_IDS.WIZARD],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'a small block of granite',
  magicSchoolId: schoolId('EVOCATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.WALL_OF_STONE, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.WALL_OF_STONE, 0x201, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 120,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.WALL_OF_STONE, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.WALL_OF_STONE, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.WALL_OF_STONE, 0x202, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 10
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.WALL_OF_STONE, 0x212, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE,
                attachmentKind: 'PLACED_SPACE'
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
