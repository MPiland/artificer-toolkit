import type {
  CapabilityAuthored,
  EffectAuthored,
  FeatGrantAuthored,
  ModifierGrantAuthored,
  ProficiencyGrantAuthored,
  SenseGrantAuthored,
  SpellGrantAuthored,
  ChargeAuthored,
  FacetAuthored
} from '#authored'
import type { FeatureAttribute, NodeSubjectCode } from '#core'

export interface FeatureBaseAuthored<N extends NodeSubjectCode = NodeSubjectCode> {
  id: string
  label: string
  description: string
  attributes?: FeatureAttribute[]
  detail?: string
  capabilities?: CapabilityAuthored[]
  /** @deprecated Use capabilities. */
  effects?: EffectAuthored[]
  charges?: ChargeAuthored
  grants?: {
    feats?: FeatGrantAuthored<N>[]
    modifiers?: ModifierGrantAuthored<N>[]
    proficiencies?: ProficiencyGrantAuthored<N>[]
    senses?: SenseGrantAuthored<N>[]
    spells?: SpellGrantAuthored<N>[]
  }
  restrictions?: FacetAuthored
  order: number // int
}
