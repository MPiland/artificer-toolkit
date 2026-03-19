import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const cart: VehicleAuthored = {
  id: VEHICLE_IDS.CART,
  label: 'Cart',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  speedNote: 'Dependent on draft animal',
  cost: gp(15)
}
