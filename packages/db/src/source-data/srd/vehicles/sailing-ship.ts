import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const sailingShip: VehicleAuthored = {
  id: VEHICLE_IDS.SAILING_SHIP,
  label: 'Sailing Ship',
  description:
    'A large ocean-going vessel powered by wind, suitable for long voyages and heavy cargo.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  armorClass: 15,
  hitPoints: 300,
  speed: 2,
  speedNote: '2 mph',
  crewMin: 20,
  crewMax: 20,
  passengerCapacity: 20,
  cargoCapacity: '100 tons',
  cost: gp(10000)
}
