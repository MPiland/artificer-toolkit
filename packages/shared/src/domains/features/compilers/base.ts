import type {
  FacetAuthored,
  FeatureBaseAuthored,
  FeatureRollDefinitionAuthored,
  FeatureWeaponAttackAuthored
} from '#authored'
import {
  type CompiledFeatGrant,
  type CompiledModifierGrant,
  type CompiledProficiencyGrant,
  type CompiledSenseGrant,
  type CompiledSpellGrant,
  type CompiledChargeUse,
  type CompiledEffectGroup,
  compileChargeUse,
  compileEffect,
  compileFeatGrant,
  compileSpellGrant,
  compileSenseGrant,
  compileModifierGrant,
  compileProficiencyGrant
} from '#compilers'
import type { FeatureAttribute } from '#core'

/** A Feature effect; one made with the wielded weapons keeps that (D156). */
export type CompiledFeatureEffectGroup = CompiledEffectGroup & {
  weaponAttack?: FeatureWeaponAttackAuthored
}

export type CompiledFeatureBase = {
  id: string
  /** Retained for bounded play-surface projections; historical snapshots may omit it. */
  label?: string
  attributes?: FeatureAttribute[]
  restrictions?: FacetAuthored
  effects?: CompiledFeatureEffectGroup[]
  rollDefinitions?: FeatureRollDefinitionAuthored[]
  ruleDefinitionIds?: string[]
  charges?: CompiledChargeUse
  feats?: CompiledFeatGrant[]
  modifiers?: CompiledModifierGrant[]
  proficiencies?: CompiledProficiencyGrant[]
  senses?: CompiledSenseGrant[]
  spells?: CompiledSpellGrant[]
  order: number
}

export function compileFeatureBase(authored: FeatureBaseAuthored): CompiledFeatureBase {
  const charges = authored.charges ? compileChargeUse(authored.charges) : undefined

  const effects = authored.effects?.length
    ? authored.effects.map((effect): CompiledFeatureEffectGroup => ({
        ...compileEffect(effect),
        ...(effect.weaponAttack ? { weaponAttack: effect.weaponAttack } : {})
      }))
    : undefined

  const feats = authored.grants?.feats?.length
    ? authored.grants.feats.map(compileFeatGrant)
    : undefined

  const spells = authored.grants?.spells?.length
    ? authored.grants.spells.map(compileSpellGrant)
    : undefined

  const senses = authored.grants?.senses?.length
    ? authored.grants.senses.map(compileSenseGrant)
    : undefined

  const modifiers = authored.grants?.modifiers?.length
    ? authored.grants.modifiers.map(compileModifierGrant)
    : undefined

  const proficiencies = authored.grants?.proficiencies?.length
    ? authored.grants.proficiencies.map(compileProficiencyGrant)
    : undefined
  return {
    id: authored.id,
    label: authored.label,
    attributes: authored.attributes,
    restrictions: authored.restrictions,
    effects,
    rollDefinitions: authored.rollDefinitions,
    ruleDefinitionIds: authored.ruleDefinitionIds,
    charges,
    feats,
    modifiers,
    proficiencies,
    senses,
    spells,
    order: authored.order
  }
}
