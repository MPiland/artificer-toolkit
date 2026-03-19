import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const galley: VehicleAuthored = {
  id: VEHICLE_IDS.GALLEY,
  label: 'Galley',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  speedNote: '4 mph',
  cost: gp(30000)
}
