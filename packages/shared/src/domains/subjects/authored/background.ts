import type { SUBJECT, AuthoredRecordStatus } from '#core'
import type {
  FeatureAuthored,
  ProficiencyGrantAuthored,
  DetailAuthored,
  StartingEquipmentAuthored
} from '#authored'

export interface BackgroundAuthored {
  kind: typeof SUBJECT.BACKGROUND
  id: string
  label: string
  description?: string
  status?: AuthoredRecordStatus
  details?: DetailAuthored[]
  startingEquipment?: StartingEquipmentAuthored
  proficiencies?: ProficiencyGrantAuthored[]
  features?: FeatureAuthored[]
  userId: string
  systemId: string
}
