import type { FeatAuthored } from '#authored'
import {
  compileCharge,
  type CompiledCharge,
  compileSpellGrant,
  type CompiledSpellGrant,
  compileSenseGrant,
  type CompiledSenseGrant,
  compileModifierGrant,
  type CompiledModifierGrant,
  compileProficiencyGrant,
  type CompiledProficiencyGrant,
  compileFeature,
  type CompiledFeature,
  compileEffect,
  type CompiledEffectGroup,
  type CompiledTargetGroups,
  compileTargetGroups
} from '#compiler'

export type CompiledFeat = {
  id: string
  effects?: CompiledEffectGroup[]
  charges?: CompiledCharge
  modifiers?: CompiledModifierGrant[]
  proficiencies?: CompiledProficiencyGrant[]
  senses?: CompiledSenseGrant[]
  spells?: CompiledSpellGrant[]
  restrictionGroups?: CompiledTargetGroups<'FEAT'>
  features?: CompiledFeature[]
}

export function compileFeat(authored: FeatAuthored): CompiledFeat {
  const effects
    = authored.effects && authored.effects.length
      ? authored.effects.map(compileEffect)
      : undefined

  const modifiers
    = authored.grants?.modifiers && authored.grants.modifiers.length
      ? authored.grants.modifiers.map(compileModifierGrant)
      : undefined

  const senses
    = authored.grants?.senses && authored.grants.senses.length
      ? authored.grants.senses.map(compileSenseGrant)
      : undefined

  const proficiencies
    = authored.grants?.proficiencies && authored.grants.proficiencies.length
      ? authored.grants.proficiencies.map(compileProficiencyGrant)
      : undefined

  const spells
    = authored.grants?.spells && authored.grants.spells.length
      ? authored.grants.spells.map(compileSpellGrant)
      : undefined

  const restrictionGroups
    = authored.restrictionGroups
      ? compileTargetGroups(authored.restrictionGroups)
      : undefined

  const features
    = authored.features && authored.features.length
      ? authored.features.map(compileFeature)
      : undefined

  const charges = authored.charges ? compileCharge(authored.charges) : undefined

  return {
    id: authored.id,
    modifiers,
    spells,
    proficiencies,
    senses,
    features,
    effects,
    restrictionGroups,
    charges
  }
}
