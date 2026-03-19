import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const keelboat: VehicleAuthored = {
  id: VEHICLE_IDS.KEELBOAT,
  label: 'Keelboat',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  speedNote: '1 mph',
  cost: gp(3000)
}
