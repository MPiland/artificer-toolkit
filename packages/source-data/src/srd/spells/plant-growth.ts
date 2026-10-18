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
  SHAPE_KIND,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const plantGrowth: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.PLANT_GROWTH,
  label: 'Plant Growth',
  description:
    "<p>This spell channels vitality into plants within a specific area. There are two possible uses for the spell, granting either immediate or long-term benefits. If you cast this spell using 1 action, choose a point within range. All normal plants in a 100-foot radius centered on that point become thick and overgrown. A creature moving through the area must spend 4 feet of movement for every 1 foot it moves. You can exclude one or more areas of any size within the spell's area from being affected. If you cast this spell over 8 hours, you enrich the land. All plants in a half-mile radius centered on a point within range become enriched for 1 year. The plants yield twice the normal amount of food when harvested.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 3,
  classIds: [CLASS_IDS.BARD, CLASS_IDS.DRUID, CLASS_IDS.RANGER],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('TRANSMUTATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 150,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        shape: {
          id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x214, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: { amount: 100, unit: MEASUREMENT_UNIT_CODE.FEET }
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x212, 1) + '__result',
            resultKind: 'SEQUENCE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x213, 1),
              durationKind: DURATION_KIND.INSTANTANEOUS
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x212, 1),
                // The overgrowth stays until the GM removes it.
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE,
                attachmentKind: 'PLACED_SPACE',
                label: 'Plant Growth',
                shape: {
                  id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x220, 1),
                  shapeKind: SHAPE_KIND.SPHERE,
                  radius: { amount: 100, unit: MEASUREMENT_UNIT_CODE.FEET }
                },
                components: [
                  {
                    id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x221, 1),
                    order: 1,
                    label: 'Overgrown plants',
                    // Each foot of movement through the area costs 4 feet.
                    movementCostMultiplier: 4
                  }
                ]
              },
              {
                id: spellChildId(SPELL_IDS.PLANT_GROWTH, 0x2f0, 1),
                effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
                label: 'Exclude Areas',
                reasonCode: 'PLAYER_DECLARATION' as const,
                instructions:
                  "You can exclude one or more areas of any size within the spell's area from being affected."
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
