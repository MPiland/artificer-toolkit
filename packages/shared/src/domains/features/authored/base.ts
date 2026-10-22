import type {
  EffectAuthored,
  FeatGrantAuthored,
  ModifierGrantAuthored,
  ProficiencyGrantAuthored,
  SenseGrantAuthored,
  SpellGrantAuthored,
  SpellSlotTableAuthored,
  ChargeAuthored,
  DetailAuthored,
  FacetAuthored
} from '#authored'
import type {
  DiceExpression,
  EquipmentGrip,
  EquipmentPropertyCode,
  FeatureAttribute,
  NodeSubjectCode
} from '#core'

/** The spell an action casts: the level it is cast at (D136). */
export interface FeatureSpellCastAuthored {
  castLevel: number
}

/**
 * An action that casts one of the spells its holder is granted, chosen at the table (D156): a
 * cantrip, or a levelled spell cast from a slot as normal. It authors no outcome paths of its own;
 * the chosen spell's effect resolves.
 */
export interface FeatureGrantedSpellCastAuthored {
  spellKind: 'CANTRIP' | 'LEVELED'
}

/**
 * A Feature weapon attack made with each weapon its Character wields (D156, Volley and Whirlwind
 * Attack): the action is offered once per wielded weapon that makes an attack of the effect's
 * trigger and has every listed property, with that weapon's attack and damage.
 */
export interface FeatureWeaponAttackAuthored {
  requiredPropertyCodes?: EquipmentPropertyCode[]
}

/**
 * A Feature effect; a versatile weapon attack authors one effect per grip (D57 ruling 1), an
 * action that casts a spell names it (D136), and an attack made with the wielded weapons says so.
 */
export type FeatureEffectAuthored = EffectAuthored & {
  grip?: EquipmentGrip
  spellCast?: FeatureSpellCastAuthored
  grantedSpellCast?: FeatureGrantedSpellCastAuthored
  weaponAttack?: FeatureWeaponAttackAuthored
}

export interface FeatureRollDefinitionAuthored {
  id: string
  label: string
  kind: 'ATTACK' | 'DAMAGE' | 'HEALING' | 'ABILITY_CHECK' | 'SAVING_THROW'
  expression: DiceExpression
  /** A code from the System's roll-mode vocabulary. */
  rollMode?: string
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
    spellSlots?: SpellSlotTableAuthored
  }
  restrictions?: FacetAuthored
  order: number // int
}
