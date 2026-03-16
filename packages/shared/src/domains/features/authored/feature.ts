import type { FeatureBaseAuthored, OptionAuthored } from '#authored'
import type { NodeSubjectCode } from '#core'

export interface FeatureOptionChoice {
  level: number // int
  count: number // int
  replaceCount?: number | null // int
}

export type FeatureAuthored<N extends NodeSubjectCode = NodeSubjectCode> = FeatureBaseAuthored<N> & {
  optionChoices?: FeatureOptionChoice[]
  options?: OptionAuthored<N>[]
  availableAtLevel?: number
}
