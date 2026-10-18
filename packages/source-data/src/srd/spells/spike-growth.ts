import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  MANIFEST_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SCALING,
  SHAPE_KIND,
  SPELL_ATTRIBUTE,
  SUBJECT,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  SPELL_COMPONENT,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { damageTypeId, schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'
export const spikeGrowth: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.SPIKE_GROWTH,
  label: 'Spike Growth',
  attributes: [SPELL_ATTRIBUTE.CONCENTRATION],
  description:
    "<p>The ground in a 20-foot radius centered on a point within range twists and sprouts hard spikes and thorns. The area becomes difficult terrain for the duration. When a creature moves into or within the area, it takes 2d4 piercing damage for every 5 feet it travels. The transformation of the ground is camouflaged to look natural. Any creature that can't see the area at the time the spell is cast must make a Wisdom (Perception) check against your spell save DC to recognize the terrain as hazardous before entering it.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 2,
  classIds: [CLASS_IDS.DRUID, CLASS_IDS.RANGER],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'seven sharp thorns or seven small twigs, each sharpened to a point',
  magicSchoolId: schoolId('TRANSMUTATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 150,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        },
        shape: {
          id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x212, 1),
          shapeKind: SHAPE_KIND.SPHERE,
          radius: {
            amount: 20,
            unit: MEASUREMENT_UNIT_CODE.FEET
          }
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x213, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x213, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x214, 1),
              durationKind: DURATION_KIND.MINUTE,
              amount: 10
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x213, 1),
                effectKind: EFFECT_KIND.MANIFEST,
                manifestKind: MANIFEST_KIND.ZONE,
                attachmentKind: 'PLACED_SPACE',
                label: 'Spike Growth',
                shape: {
                  id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x220, 1),
                  shapeKind: SHAPE_KIND.SPHERE,
                  radius: { amount: 20, unit: MEASUREMENT_UNIT_CODE.FEET }
                },
                components: [
                  {
                    id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x221, 1),
                    order: 1,
                    label: 'Spikes and thorns',
                    interactionKinds: ['ENTER_OR_PASS_THROUGH' as const],
                    movementCostMultiplier: 2,
                    perDistanceMoved: { amount: 5, unit: MEASUREMENT_UNIT_CODE.FEET },
                    behaviors: [
                      {
                        id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x222, 1),
                        order: 1,
                        invocation: {
                          kind: 'PASSIVE' as const,
                          triggerCode: TRIGGER.ACTIVATED,
                          range: {
                            id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x223, 1),
                            rangeKind: RANGE_KIND.SELF
                          }
                        },
                        paths: [
                          {
                            id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x224, 1),
                            order: 1,
                            pathCode: PATH_CODE.ON_USE,
                            groupType: PATH_GROUP_TYPE.SINGLE,
                            originKind: 'SOURCE' as const,
                            selectionKind: 'FIXED' as const,
                            resultBlock: {
                              id: `${spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x224, 1)}__result`,
                              resultKind: 'SINGLE' as const,
                              outcomes: [
                                {
                                  id: spellChildId(SPELL_IDS.SPIKE_GROWTH, 0x225, 1),
                                  effectKind: EFFECT_KIND.DAMAGE,
                                  damageTypeId: damageTypeId('PIERCING'),
                                  valueKind: DAMAGE_VALUE_KIND.DICE,
                                  diceConfig: '2d4',
                                  scalingKind: SCALING.NONE
                                }
                              ]
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
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
