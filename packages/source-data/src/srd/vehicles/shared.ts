import {
  CLOSED_RULE_KIND,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER,
  type ClosedRuleKind,
  type FeatureAuthored
} from '@artificer-toolkit/shared'
import { VEHICLE_IDS } from '../ids.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

const CURRENCY_GP = '00000000-0000-0000-0003-000400000000'

export function gp(amount: number) {
  return { amount, currencyId: CURRENCY_GP }
}

export function pounds(amount: number) {
  return { amount, unit: 'POUNDS' as const }
}

function vehicleChildId(vehicleId: string, bucket: number, index: number): string {
  const [, , , vehicleDomain, vehicleSuffix] = vehicleId.split('-')
  const bucketHex = bucket.toString(16).padStart(4, '0')
  const indexHex = index.toString(16).padStart(12, '0')
  return `${vehicleDomain.padStart(8, '0')}-0000-${bucketHex}-${vehicleSuffix.slice(0, 4)}-${indexHex}`
}

function vehicleRuleFeature(
  vehicleId: string,
  label: string,
  description: string,
  ruleKind: ClosedRuleKind
): FeatureAuthored {
  return {
    id: vehicleChildId(vehicleId, 0x210, 1),
    label,
    description,
    order: 1,
    effects: [
      {
        id: vehicleChildId(vehicleId, 0x211, 1),
        order: 1,
        invocation: {
          kind: 'PASSIVE',
          triggerCode: TRIGGER.ACTIVATED,
          range: {
            id: vehicleChildId(vehicleId, 0x212, 1),
            rangeKind: RANGE_KIND.SELF
          }
        },
        paths: [
          {
            id: vehicleChildId(vehicleId, 0x213, 1),
            order: 1,
            pathCode: PATH_CODE.ON_USE,
            groupType: PATH_GROUP_TYPE.SINGLE,
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: `${vehicleChildId(vehicleId, 0x213, 1)}__result`,
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: vehicleChildId(vehicleId, 0x214, 1),
                  effectKind: EFFECT_KIND.CLOSED_RULE,
                  ruleKind
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

export function draftAnimalCapacityFeature(vehicleId: string): FeatureAuthored {
  return vehicleRuleFeature(
    vehicleId,
    'Mounts and Vehicles',
    'An animal pulling a carriage, cart, chariot, sled, or wagon can move weight up to five times its base carrying capacity, including the weight of the vehicle. If multiple animals pull the same vehicle, they can add their carrying capacity together.',
    CLOSED_RULE_KIND.VEHICLE_DRAFT_ANIMAL_CAPACITY
  )
}

export function rowedVesselFeature(vehicleId: string): FeatureAuthored {
  return vehicleRuleFeature(
    vehicleId,
    'Rowed Vessels',
    "Keelboats and rowboats are used on lakes and rivers. If going downstream, add the speed of the current (typically 3 miles per hour) to the speed of the vehicle. These vehicles can't be rowed against any significant current, but they can be pulled upstream by draft animals on the shores. A rowboat weighs 100 pounds, in case adventurers carry it over land.",
    CLOSED_RULE_KIND.VEHICLE_ROWED_VESSEL_CURRENT
  )
}

export { VEHICLE_IDS, SRD_SYSTEM_ID, SRD_USER_ID }
