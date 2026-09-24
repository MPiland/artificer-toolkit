import type { VehicleAuthored } from '@artificer-toolkit/shared'
import {
  draftAnimalCapacityFeature,
  gp,
  pounds,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  VEHICLE_IDS
} from './shared.js'

export const carriage: VehicleAuthored = {
  id: VEHICLE_IDS.CARRIAGE,
  label: 'Carriage',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  weight: pounds(600),
  features: [draftAnimalCapacityFeature(VEHICLE_IDS.CARRIAGE)],
  cost: gp(100)
}
