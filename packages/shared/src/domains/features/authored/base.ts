import type {
  EffectAuthored,
  FeatGrantAuthored,
  ModifierGrantAuthored,
  ProficiencyGrantAuthored,
  SenseGrantAuthored,
  SpellGrantAuthored,
  ChargeAuthored,
  DetailAuthored,
  FacetAuthored
} from '#authored'
import type { DiceExpression, FeatureAttribute, NodeSubjectCode } from '#core'

export interface FeatureRollDefinitionAuthored {
  id: string
  label: string
  kind: 'ATTACK' | 'DAMAGE' | 'HEALING' | 'ABILITY_CHECK' | 'SAVING_THROW'
  expression: DiceExpression
  rollMode?: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
  chargeCost?: number | null
  order: number
}

export interface FeatureBaseAuthored<N extends NodeSubjectCode = NodeSubjectCode> {
  id: string
  label: string
  description: string
  attributes?: FeatureAttribute[]
  details?: DetailAuthored[]
  effects?: EffectAuthored[]
  rollDefinitions?: FeatureRollDefinitionAuthored[]
  ruleDefinitionIds?: string[]
  charges?: ChargeAuthored<true>
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
