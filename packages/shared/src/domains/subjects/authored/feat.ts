import type {
  EffectAuthored,
  FacetAuthored,
  FeatGrantAuthored,
  ModifierGrantAuthored,
  ProficiencyGrantAuthored,
  SenseGrantAuthored,
  SpellGrantAuthored,
  FeatureAuthored,
  ChargeAuthored
} from '#authored'

export interface FeatAuthored {
  id: string
  label: string
  description: string
  status?: import('#core').AuthoredRecordStatus
  detail?: string
  prerequisites?: FacetAuthored<'CHARACTER'>
  effects?: EffectAuthored[]
  charges?: ChargeAuthored
  grants?: {
    feats?: FeatGrantAuthored[]
    modifiers?: ModifierGrantAuthored[]
    proficiencies?: ProficiencyGrantAuthored[]
    senses?: SenseGrantAuthored[]
    spells?: SpellGrantAuthored[]
  }
  features?: FeatureAuthored[]
  userId: string
  systemId: string
}

