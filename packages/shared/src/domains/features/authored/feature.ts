import type { FeatureBaseAuthored, OptionAuthored } from '#authored'

export interface OptionsByLevel {
  level: number // int
  count: number // int
  replaceCount?: number | null // int
}

export type FeatureAuthored = FeatureBaseAuthored & {
  optionsPerLevel?: OptionsByLevel[]
  options?: OptionAuthored[]
  levelAvailable?: string
}
