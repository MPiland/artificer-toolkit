import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const galley: VehicleAuthored = {
  id: VEHICLE_IDS.GALLEY,
  label: 'Galley',
  description:
    'A large warship propelled by oarsmen, capable of high speeds and carrying siege weapons.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  armorClass: 15,
  hitPoints: 500,
  speed: 4,
  speedNote: '4 mph',
  crewMin: 80,
  crewMax: 80,
  passengerCapacity: 0,
  cargoCapacity: '150 tons',
  cost: gp(30000)
}
