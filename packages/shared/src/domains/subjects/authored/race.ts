import type { RACE_CATEGORY_CODE, RaceSelectionMode, SizeCode, AuthoredRecordStatus } from '#core'
import type {
  FeatureAuthored,
  DetailAuthored,
  SpeedAuthored
} from '#authored'

export interface RaceAncestryAuthored {
  id: string
  label: string
  description?: string | null
  options: RaceAncestryOptionAuthored[]
}

export interface RaceAncestryOptionAuthored {
  id: string
  label: string
  description: string
  order: number // int
  features?: FeatureAuthored[]
}

export type BaseRaceAuthored = {
  id: string
  label: string
  quote?: string
  description?: string
  status?: AuthoredRecordStatus
  category: typeof RACE_CATEGORY_CODE.BASE
  selectionMode: RaceSelectionMode
  ancestry?: RaceAncestryAuthored
  heritageIds?: string[]
  details?: DetailAuthored[]
  features?: FeatureAuthored[]
  size: SizeCode
  speeds: SpeedAuthored[]
  userId: string
  systemId: string
}

export type SubraceAuthored = {
  id: string
  label: string
  quote?: string
  description?: string
  status?: AuthoredRecordStatus
  category: typeof RACE_CATEGORY_CODE.SUBRACE
  parentRaceId: string
  details?: DetailAuthored[]
  features?: FeatureAuthored[]
  userId: string
  systemId: string
}

export type RaceAuthored = BaseRaceAuthored | SubraceAuthored
