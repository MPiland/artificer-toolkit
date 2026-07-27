import type { FeatureBaseAuthored, OptionAuthored } from '#authored'
import type { FeatureSection, NodeSubjectCode } from '#core'

export interface FeatureOptionChoice {
  level: number // int
  count: number // int
  replaceCount?: number | null // int
}

export type FeatureAuthored<N extends NodeSubjectCode = NodeSubjectCode> =
  FeatureBaseAuthored<N> & {
    section?: FeatureSection
    optionChoices?: FeatureOptionChoice[]
    options?: OptionAuthored<N>[]
    availableAtLevel?: number
  }
