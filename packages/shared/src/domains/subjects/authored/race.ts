import type { RACE_CATEGORY_CODE, SizeCode } from '#core'
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

export type RaceBaseAuthored = {
  id: string
  label: string
  quote?: string
  description?: string
  details?: DetailAuthored[]
  features?: FeatureAuthored[]
  userId: string
  systemId: string
}

export type ParentRaceAuthored = {
  category: typeof RACE_CATEGORY_CODE.BASE
  playable: boolean
  ancestry?: RaceAncestryAuthored
  size: SizeCode
  speeds: SpeedAuthored[]
} & RaceBaseAuthored

export type SubraceAuthored = {
  category: typeof RACE_CATEGORY_CODE.SUBRACE
  parentRaceId: string
  size?: SizeCode
  speeds?: SpeedAuthored[]
} & RaceBaseAuthored

export type RaceAuthored = ParentRaceAuthored | SubraceAuthored
