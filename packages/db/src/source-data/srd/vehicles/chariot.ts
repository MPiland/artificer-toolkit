import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const chariot: VehicleAuthored = {
  id: VEHICLE_IDS.CHARIOT,
  label: 'Chariot',
  description:
    'A light two-wheeled vehicle pulled by draft animals, designed for speed in combat or racing.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  armorClass: 13,
  hitPoints: 50,
  speedNote: 'Dependent on draft animal',
  crewMin: 1,
  crewMax: 1,
  passengerCapacity: 0,
  cargoCapacity: '0',
  cost: gp(250)
}
