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
import type { DiceExpression, EquipmentGrip, FeatureAttribute, NodeSubjectCode } from '#core'

/** A Feature effect; a versatile weapon attack authors one effect per grip (D57 ruling 1). */
export type FeatureEffectAuthored = EffectAuthored & { grip?: EquipmentGrip }

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
  effects?: FeatureEffectAuthored[]
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
