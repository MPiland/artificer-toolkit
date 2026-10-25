import {
  ACTIVATION_CODE,
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  EFFECT_KIND,
  MEASUREMENT_UNIT_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SPELL_COMPONENT,
  SUBJECT,
  TRIGGER,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { CLASS_IDS, SPELL_IDS } from '../ids.js'
import { SIZE_CODE } from '../sizes.js'
import { schoolId, spellChildId, SRD_SYSTEM_ID, SRD_USER_ID } from './shared.js'

export const transportViaPlants: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: SPELL_IDS.TRANSPORT_VIA_PLANTS,
  label: 'Transport via Plants',
  description:
    '<p>This spell creates a magical link between a Large or larger inanimate plant within range and another plant, at any distance, on the same plane of existence. You must have seen or touched the destination plant at least once before. For the duration, any creature can step into the target plant and exit from the destination plant by using 5 feet of movement.</p>',
  castingTime: { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 },
  level: 6,
  classIds: [CLASS_IDS.DRUID],
  components: [SPELL_COMPONENT.VERBAL, SPELL_COMPONENT.SOMATIC],
  magicSchoolId: schoolId('CONJURATION'),
  effects: [
    {
      id: spellChildId(SPELL_IDS.TRANSPORT_VIA_PLANTS, 0x210, 1),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: spellChildId(SPELL_IDS.TRANSPORT_VIA_PLANTS, 0x211, 1),
          rangeKind: RANGE_KIND.DISTANCE,
          amount: 10,
          unit: MEASUREMENT_UNIT_CODE.FEET
        }
      },
      paths: [
        {
          id: spellChildId(SPELL_IDS.TRANSPORT_VIA_PLANTS, 0x212, 1),
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: `${spellChildId(SPELL_IDS.TRANSPORT_VIA_PLANTS, 0x212, 1)}__result`,
            resultKind: 'SINGLE',
            duration: {
              id: spellChildId(SPELL_IDS.TRANSPORT_VIA_PLANTS, 0x213, 1),
              durationKind: DURATION_KIND.ROUND,
              amount: 1
            },
            outcomes: [
              {
                id: spellChildId(SPELL_IDS.TRANSPORT_VIA_PLANTS, 0x214, 1),
                effectKind: EFFECT_KIND.PLANT_PORTAL,
                minimumPlantSize: SIZE_CODE.LARGE,
                requiresInanimatePlant: true,
                samePlaneOnly: true,
                destinationMustBeSeenOrTouched: true,
                movementCost: { amount: 5, unit: MEASUREMENT_UNIT_CODE.FEET }
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
