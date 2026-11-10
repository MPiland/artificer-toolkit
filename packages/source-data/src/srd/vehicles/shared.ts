import type { FeatureAuthored } from '@artificer-toolkit/shared'
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

/** A vehicle rule that changes no resolved state, so it is description-only (D156). */
function vehicleRuleFeature(
  vehicleId: string,
  label: string,
  description: string
): FeatureAuthored {
  return { id: vehicleChildId(vehicleId, 0x210, 1), label, description, order: 1 }
}

export function draftAnimalCapacityFeature(vehicleId: string): FeatureAuthored {
  return vehicleRuleFeature(
    vehicleId,
    'Mounts and Vehicles',
    'An animal pulling a carriage, cart, chariot, sled, or wagon can move weight up to five times its base carrying capacity, including the weight of the vehicle. If multiple animals pull the same vehicle, they can add their carrying capacity together.'
  )
}

export function rowedVesselFeature(vehicleId: string): FeatureAuthored {
  return vehicleRuleFeature(
    vehicleId,
    'Rowed Vessels',
    "Keelboats and rowboats are used on lakes and rivers. If going downstream, add the speed of the current (typically 3 miles per hour) to the speed of the vehicle. These vehicles can't be rowed against any significant current, but they can be pulled upstream by draft animals on the shores. A rowboat weighs 100 pounds, in case adventurers carry it over land."
  )
}

export { VEHICLE_IDS, SRD_SYSTEM_ID, SRD_USER_ID }
