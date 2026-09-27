import type { FeatureBaseAuthored } from '#authored'
import type { NodeSubjectCode } from '#core'

/** A Legendary option that runs its Creature's own action Feature at this charge cost (D51). */
export interface FeatureOptionActionReferenceAuthored {
  featureId: string
  chargeCost: number
}

export type OptionAuthored<N extends NodeSubjectCode = NodeSubjectCode> = FeatureBaseAuthored<N> & {
  actionReference?: FeatureOptionActionReferenceAuthored
}
