import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const longship: VehicleAuthored = {
  id: VEHICLE_IDS.LONGSHIP,
  label: 'Longship',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  speed: 3,
  speedNote: '3 mph',
  cost: gp(10000)
}
