import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const warship: VehicleAuthored = {
  id: VEHICLE_IDS.WARSHIP,
  label: 'Warship',
  description: 'A heavily armed sailing vessel built for naval combat, with reinforced hull and weapon emplacements.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  armorClass: 15,
  hitPoints: 500,
  speed: 3,
  speedNote: '2½ mph',
  crewMin: 60,
  crewMax: 60,
  passengerCapacity: 60,
  cargoCapacity: '200 tons',
  cost: gp(25000)
}
