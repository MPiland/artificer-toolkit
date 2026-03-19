import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const chariot: VehicleAuthored = {
  id: VEHICLE_IDS.CHARIOT,
  label: 'Chariot',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  cost: gp(250)
}
