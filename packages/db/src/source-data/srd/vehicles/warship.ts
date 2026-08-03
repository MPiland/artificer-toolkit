import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const warship: VehicleAuthored = {
  id: VEHICLE_IDS.WARSHIP,
  label: 'Warship',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  speed: 2.5,
  speedNote: '2½ mph',
  cost: gp(25000)
}
