import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const cart: VehicleAuthored = {
  id: VEHICLE_IDS.CART,
  label: 'Cart',
  description:
    'A two-wheeled open vehicle pulled by a draft animal. Common transport for goods and supplies.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  armorClass: 11,
  hitPoints: 50,
  speedNote: 'Dependent on draft animal',
  crewMin: 0,
  crewMax: 1,
  passengerCapacity: 0,
  cargoCapacity: '200 lb.',
  cost: gp(15)
}
