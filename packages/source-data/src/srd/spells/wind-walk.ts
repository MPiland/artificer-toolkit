import {
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
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
import {
  nonmagicalResistanceGrants,
  WEAPON_DAMAGE_TYPE_CODES,
  schoolId,
  spellChildId,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from './shared.js'
export const windWalk: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.WIND_WALK,
  label: 'Wind Walk',
  description:
    "<p>You and up to ten willing creatures you can see within range assume a gaseous form for the duration, appearing as wisps of cloud. While in this cloud form, a creature has a flying speed of 300 feet and has resistance to damage from nonmagical weapons. The only actions a creature can take in this form are the Dash action or to revert to its normal form. Reverting takes 1 minute, during which time a creature is incapacitated and can't move. Until the spell ends, a creature can revert to cloud form, which also requires the 1-minute transformation. If a creature is in cloud form and flying when the effect ends, the creature descends 60 feet per round for 1 minute until it lands, which it does safely. If it can't land after 1 minute, the creature falls the remaining distance.</p>",
  castingTime: { unit: CASTING_TIME_UNIT_CODE.MINUTE, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC, SPELL_COMPONENT.MATERIAL],
  materialDescription: 'fire and holy water',
  magicSchoolId: schoolId('TRANSMUTATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.WIND_WALK, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.ACTIVATED,
        activation: {
          code: ACTIVATION_CODE.ACTION,
          amount: 1
        },
        range: {
          id: spellChildId(SPELL_IDS.WIND_WALK, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 30,
          unit: MEASUREMENT_UNIT_CODE.FEET
        },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY,
          maxTargets: 11
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.WIND_WALK, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: spellChildId(SPELL_IDS.WIND_WALK, 0x212, 1) + '__result',
            resultKind: 'SINGLE' as const,
            duration: {
              id: spellChildId(SPELL_IDS.WIND_WALK, 0x213, 1),
              durationKind: DURATION_KIND.HOUR,
              amount: 8
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.WIND_WALK, 0x212, 1),
                effectKind: EFFECT_KIND.APPLY_GRANT,
                grants: {
                  modifiers: nonmagicalResistanceGrants(WEAPON_DAMAGE_TYPE_CODES, (entry) =>
                    spellChildId(SPELL_IDS.WIND_WALK, 0x214, entry)
                  )
                }
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
