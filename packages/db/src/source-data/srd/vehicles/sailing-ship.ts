import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const sailingShip: VehicleAuthored = {
  id: VEHICLE_IDS.SAILING_SHIP,
  label: 'Sailing Ship',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  speedNote: '2 mph',
  cost: gp(10000)
}
