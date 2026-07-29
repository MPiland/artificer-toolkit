import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const wagon: VehicleAuthored = {
  id: VEHICLE_IDS.WAGON,
  label: 'Wagon',
  description:
    'A large four-wheeled vehicle pulled by draft animals, used to haul heavy loads over long distances.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  armorClass: 11,
  hitPoints: 80,
  speedNote: 'Dependent on draft animal',
  crewMin: 1,
  crewMax: 2,
  passengerCapacity: 8,
  cargoCapacity: '4 tons',
  cost: gp(35)
}
