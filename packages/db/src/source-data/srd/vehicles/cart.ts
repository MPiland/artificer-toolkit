import type { VehicleAuthored } from '@artificer-toolkit/shared'
import {
  draftAnimalCapacityFeature,
  gp,
  pounds,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  VEHICLE_IDS
} from './shared.js'

export const cart: VehicleAuthored = {
  id: VEHICLE_IDS.CART,
  label: 'Cart',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  weight: pounds(200),
  features: [draftAnimalCapacityFeature(VEHICLE_IDS.CART)],
  cost: gp(15)
}
