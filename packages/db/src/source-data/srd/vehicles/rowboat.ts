import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const rowboat: VehicleAuthored = {
  id: VEHICLE_IDS.ROWBOAT,
  label: 'Rowboat',
  description: 'A small open boat propelled by oars. Used for short river and lake crossings.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  armorClass: 11,
  hitPoints: 50,
  speed: 1,
  speedNote: '1½ mph',
  crewMin: 1,
  crewMax: 2,
  passengerCapacity: 3,
  cargoCapacity: '½ ton',
  cost: gp(50)
}
