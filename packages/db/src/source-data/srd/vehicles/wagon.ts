import type { VehicleAuthored } from '@artificer-toolkit/shared'
import {
  draftAnimalCapacityFeature,
  gp,
  pounds,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  VEHICLE_IDS
} from './shared.js'

export const wagon: VehicleAuthored = {
  id: VEHICLE_IDS.WAGON,
  label: 'Wagon',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  weight: pounds(400),
  features: [draftAnimalCapacityFeature(VEHICLE_IDS.WAGON)],
  cost: gp(35)
}
