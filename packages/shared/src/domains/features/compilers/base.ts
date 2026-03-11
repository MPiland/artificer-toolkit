import type { FeatureBaseAuthored } from '#authored'
import {
  type CompiledFeatGrant,
  type CompiledModifierGrant,
  type CompiledProficiencyGrant,
  type CompiledSenseGrant,
  type CompiledSpellGrant,
  type CompiledCharge,
  type CompiledEffectGroup,
  compileCharge,
  compileEffect,
  compileFeatGrant,
  compileSpellGrant,
  compileSenseGrant,
  compileModifierGrant,
  compileProficiencyGrant
} from '#compilers'
import type { FeatureAttribute } from '#core'

export type CompiledFeatureBase = {
  id: string
  attributes?: FeatureAttribute[]
  effects?: CompiledEffectGroup[]
  charges?: CompiledCharge
  feats?: CompiledFeatGrant[]
  modifiers?: CompiledModifierGrant[]
  proficiencies?: CompiledProficiencyGrant[]
  senses?: CompiledSenseGrant[]
  spells?: CompiledSpellGrant[]
  order: number
}

export function compileFeatureBase(authored: FeatureBaseAuthored): CompiledFeatureBase {
  const charges = authored.charges ? compileCharge(authored.charges) : undefined

  const effects = authored.effects?.length
    ? authored.effects.map(compileEffect)
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
    attributes: authored.attributes,
    effects,
    charges,
    feats,
    modifiers,
    proficiencies,
    senses,
    spells,
    order: authored.order
  }
}
