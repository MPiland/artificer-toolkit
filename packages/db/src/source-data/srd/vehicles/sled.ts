import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const sled: VehicleAuthored = {
  id: VEHICLE_IDS.SLED,
  label: 'Sled',
  description:
    'A flat-bottomed vehicle designed to travel over snow and ice, pulled by draft animals.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  armorClass: 11,
  hitPoints: 50,
  speedNote: 'Dependent on draft animal',
  crewMin: 1,
  crewMax: 2,
  passengerCapacity: 0,
  cargoCapacity: '1 ton',
  cost: gp(20)
}
