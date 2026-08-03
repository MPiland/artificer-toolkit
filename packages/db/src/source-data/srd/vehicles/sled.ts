import type { VehicleAuthored } from '@artificer-toolkit/shared'
import {
  draftAnimalCapacityFeature,
  gp,
  pounds,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  VEHICLE_IDS
} from './shared.js'

export const sled: VehicleAuthored = {
  id: VEHICLE_IDS.SLED,
  label: 'Sled',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  weight: pounds(300),
  features: [draftAnimalCapacityFeature(VEHICLE_IDS.SLED)],
  cost: gp(20)
}
