import type { VehicleAuthored } from '@artificer-toolkit/shared'
import {
  draftAnimalCapacityFeature,
  gp,
  pounds,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  VEHICLE_IDS
} from './shared.js'

export const chariot: VehicleAuthored = {
  id: VEHICLE_IDS.CHARIOT,
  label: 'Chariot',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  weight: pounds(100),
  features: [draftAnimalCapacityFeature(VEHICLE_IDS.CHARIOT)],
  cost: gp(250)
}
