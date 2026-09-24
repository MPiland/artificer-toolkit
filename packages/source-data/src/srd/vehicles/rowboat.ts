import type { VehicleAuthored } from '@artificer-toolkit/shared'
import {
  gp,
  pounds,
  rowedVesselFeature,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  VEHICLE_IDS
} from './shared.js'

export const rowboat: VehicleAuthored = {
  id: VEHICLE_IDS.ROWBOAT,
  label: 'Rowboat',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'WATER',
  speed: 1.5,
  speedNote: '1½ mph',
  weight: pounds(100),
  features: [rowedVesselFeature(VEHICLE_IDS.ROWBOAT)],
  cost: gp(50)
}
