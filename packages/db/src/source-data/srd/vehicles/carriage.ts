import type { VehicleAuthored } from '@artificer-toolkit/shared'
import { gp, SRD_SYSTEM_ID, SRD_USER_ID, VEHICLE_IDS } from './shared.js'

export const carriage: VehicleAuthored = {
  id: VEHICLE_IDS.CARRIAGE,
  label: 'Carriage',
  description:
    'An enclosed four-wheeled passenger vehicle pulled by draft animals. Used by nobility and wealthy travelers.',
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  category: 'LAND',
  armorClass: 13,
  hitPoints: 100,
  speedNote: 'Dependent on draft animal',
  crewMin: 1,
  crewMax: 2,
  passengerCapacity: 4,
  cargoCapacity: '2½ tons',
  cost: gp(100)
}
