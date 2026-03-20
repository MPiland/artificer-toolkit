import type {
  CapabilityAuthored,
  ModifierGrantAuthored,
  ProficiencyGrantAuthored,
  SenseGrantAuthored,
  SpellGrantAuthored,
  EffectAuthored,
  FeatureAuthored,
  ChargeAuthored
} from '#authored'

export interface FeatAuthored {
  id: string
  label: string
  description: string
  detail?: string
  capabilities?: CapabilityAuthored[]
  /** @deprecated Use capabilities. */
  effects?: EffectAuthored[]
  charges?: ChargeAuthored
  grants?: {
    modifiers?: ModifierGrantAuthored[]
    proficiencies?: ProficiencyGrantAuthored[]
    senses?: SenseGrantAuthored[]
    spells?: SpellGrantAuthored[]
  }
  features?: FeatureAuthored[]
  userId: string
  systemId: string
}
