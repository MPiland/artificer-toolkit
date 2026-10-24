import type { FeatAuthored } from '#authored'
import {
  compileCharge,
  type CompiledCharge,
  compileSpellGrant,
  type CompiledSpellGrant,
  compileFeatGrant,
  type CompiledFeatGrant,
  compileSenseGrant,
  type CompiledSenseGrant,
  compileModifierGrant,
  type CompiledModifierGrant,
  compileProficiencyGrant,
  type CompiledProficiencyGrant,
  compileFeature,
  type CompiledFeature,
  compileEffect,
  type CompiledEffectGroup
} from '#compilers'

export type CompiledFeat = {
  id: string
  label: string
  prerequisites?: FeatAuthored['prerequisites']
  effects?: CompiledEffectGroup[]
  charges?: CompiledCharge
  feats?: CompiledFeatGrant[]
  modifiers?: CompiledModifierGrant[]
  proficiencies?: CompiledProficiencyGrant[]
  senses?: CompiledSenseGrant[]
  spells?: CompiledSpellGrant[]
  features?: CompiledFeature[]
}

export function compileFeat(authored: FeatAuthored): CompiledFeat {
  const effects = authored.effects?.length
    ? authored.effects.map((effect) => compileEffect(effect))
    : undefined

  const modifiers =
    authored.grants?.modifiers && authored.grants.modifiers.length
      ? authored.grants.modifiers.map(compileModifierGrant)
      : undefined

  const feats =
    authored.grants?.feats && authored.grants.feats.length
      ? authored.grants.feats.map(compileFeatGrant)
      : undefined

  const senses =
    authored.grants?.senses && authored.grants.senses.length
      ? authored.grants.senses.map(compileSenseGrant)
      : undefined

  const proficiencies =
    authored.grants?.proficiencies && authored.grants.proficiencies.length
      ? authored.grants.proficiencies.map(compileProficiencyGrant)
      : undefined

  const spells =
    authored.grants?.spells && authored.grants.spells.length
      ? authored.grants.spells.map(compileSpellGrant)
      : undefined

  const features =
    authored.features && authored.features.length
      ? authored.features.map(compileFeature)
      : undefined

  const charges = authored.charges ? compileCharge(authored.charges) : undefined

  return {
    id: authored.id,
    label: authored.label,
    prerequisites: authored.prerequisites,
    feats,
    modifiers,
    spells,
    proficiencies,
    senses,
    features,
    effects,
    charges
  }
}
