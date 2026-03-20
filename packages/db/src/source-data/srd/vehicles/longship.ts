import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const longship: VehicleAuthored = {
  id: VEHICLE_IDS.LONGSHIP,
  label: 'Longship',
  description: 'A fast, oar-driven ship favored by raiders and explorers, capable of ocean and river travel.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  armorClass: 15,
  hitPoints: 300,
  speed: 3,
  speedNote: '3 mph',
  crewMin: 40,
  crewMax: 40,
  passengerCapacity: 150,
  cargoCapacity: '10 tons',
  cost: gp(10000)
}
