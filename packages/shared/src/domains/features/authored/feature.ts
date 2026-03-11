import type { FeatureBaseAuthored, OptionAuthored } from '#authored'
import type { NodeSubjectCode } from '#core'

export interface OptionsByLevel {
  level: number // int
  count: number // int
  replaceCount?: number | null // int
}

export type FeatureAuthored<N extends NodeSubjectCode = NodeSubjectCode> = FeatureBaseAuthored<N> & {
  optionsPerLevel?: OptionsByLevel[]
  options?: OptionAuthored<N>[]
  levelAvailable?: string
}
