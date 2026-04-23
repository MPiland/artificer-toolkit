import type { SizeCode, AuthoredRecordStatus } from '#core'
import type {
  CostAuthored,
  DetailAuthored,
  FeatureAuthored,
} from '#authored'

export type VehicleCategory = 'LAND' | 'WATER' | 'AIR' | 'SPELLJAMMER'

export interface VehicleAuthored {
  id: string
  label: string
  description?: string
  status?: AuthoredRecordStatus
  details?: DetailAuthored[]
  userId: string
  systemId: string
  category: VehicleCategory
  size?: SizeCode
  armorClass?: number
  hitPoints?: number
  speed?: number
  speedNote?: string
  crewMin?: number
  crewMax?: number
  passengerCapacity?: number
  cargoCapacity?: string
  cost?: CostAuthored
  properties?: string[]
  features?: FeatureAuthored[]
}
