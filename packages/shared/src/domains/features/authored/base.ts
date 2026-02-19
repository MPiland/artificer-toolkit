import type {
  EffectAuthored,
  FeatGrantAuthored,
  ModifierGrantAuthored,
  ProficiencyGrantAuthored,
  SenseGrantAuthored,
  SpellGrantAuthored,
  ChargeAuthored,
  TargetGroupsAuthored
} from '#authored'
import type { FeatureAttribute } from '#core'

export interface FeatureBaseAuthored {
  id: string
  label: string
  description: string
  attributes?: FeatureAttribute[]
  detail?: string
  effects?: EffectAuthored[]
  charges?: ChargeAuthored
  grants?: {
    feats?: FeatGrantAuthored[]
    modifiers?: ModifierGrantAuthored[]
    proficiencies?: ProficiencyGrantAuthored[]
    senses?: SenseGrantAuthored[]
    spells?: SpellGrantAuthored[]
  }
  restrictionsGroups?: TargetGroupsAuthored
  order: number // int
}
