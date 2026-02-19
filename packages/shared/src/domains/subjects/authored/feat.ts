import type {
  ModifierGrantAuthored,
  ProficiencyGrantAuthored,
  SenseGrantAuthored,
  SpellGrantAuthored,
  EffectAuthored,
  FeatureAuthored,
  ChargeAuthored,
  TargetGroupsAuthored
} from '#authored'

export interface FeatAuthored {
  id: string
  label: string
  description: string
  detail?: string
  effects?: EffectAuthored[]
  charges?: ChargeAuthored
  grants?: {
    modifiers?: ModifierGrantAuthored[]
    proficiencies?: ProficiencyGrantAuthored[]
    senses?: SenseGrantAuthored[]
    spells?: SpellGrantAuthored[]
  }
  restrictionGroups?: TargetGroupsAuthored<'FEAT'>
  features?: FeatureAuthored[]
  userId: string
  systemId: string
}
