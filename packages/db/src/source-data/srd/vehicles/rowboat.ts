import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const rowboat: VehicleAuthored = {
  id: VEHICLE_IDS.ROWBOAT,
  label: 'Rowboat',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  speedNote: '1½ mph',
  cost: gp(50)
}
