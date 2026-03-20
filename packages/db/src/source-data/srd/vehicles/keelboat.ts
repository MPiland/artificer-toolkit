import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const keelboat: VehicleAuthored = {
  id: VEHICLE_IDS.KEELBOAT,
  label: 'Keelboat',
  description: 'A small riverboat with a keel for stability, capable of navigating rivers and coastal waters.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  armorClass: 15,
  hitPoints: 100,
  speed: 1,
  speedNote: '1 mph',
  crewMin: 1,
  crewMax: 3,
  passengerCapacity: 6,
  cargoCapacity: '½ ton',
  cost: gp(3000)
}
