import {
  upsertBackground,
  upsertCharge,
  upsertClass,
  upsertDetail,
  upsertEffect,
  upsertEquipment,
  upsertFeat,
  upsertFeatGrant,
  upsertFeature,
  upsertModifierGrant,
  upsertOption,
  upsertProficiencyGrant,
  upsertRace,
  upsertSavingThrow,
  upsertSenseGrant,
  upsertSpell,
  upsertSpellGrant,
  upsertStartingEquipment,
  upsertSystem
} from '../domains/index.js'
import type {
  SeedBaselineContent,
  SeedResult
} from './contracts.js'

/**
 * Seeds one system-scoped baseline content bundle into normalized persistence.
 * Vocabulary/system root seeding remains a separate concern until the
 * dedicated system/vocabulary wrappers are added.
 */
export const seedBaselineContent: SeedBaselineContent = async (
  context,
  bundle
) => {
  if (!bundle.vocabulary.systems.some((system) => system.id === context.systemId)) {
    throw new Error(`Missing system seed record for systemId "${context.systemId}".`)
  }

  for (const system of bundle.vocabulary.systems) {
    await upsertSystem(context.db, system)
  }

  for (const detail of bundle.shared.details) {
    await upsertDetail(context.db, detail)
  }

  for (const charge of bundle.shared.charges) {
    await upsertCharge(context.db, charge)
  }

  for (const savingThrow of bundle.shared.savingThrows) {
    await upsertSavingThrow(context.db, savingThrow)
  }

  for (const startingEquipment of bundle.shared.startingEquipment) {
    await upsertStartingEquipment(context.db, startingEquipment)
  }

  for (const effect of bundle.effects.effects) {
    await upsertEffect(context.db, effect)
  }

  for (const feature of bundle.features.features) {
    await upsertFeature(context.db, feature, context.systemId)
  }

  for (const option of bundle.features.options) {
    await upsertOption(context.db, option, context.systemId)
  }

  for (const featGrant of bundle.grants.feats) {
    await upsertFeatGrant(context.db, featGrant)
  }

  for (const modifierGrant of bundle.grants.modifiers) {
    await upsertModifierGrant(context.db, modifierGrant, context.systemId)
  }

  for (const proficiencyGrant of bundle.grants.proficiencies) {
    await upsertProficiencyGrant(context.db, proficiencyGrant)
  }

  for (const senseGrant of bundle.grants.senses) {
    await upsertSenseGrant(context.db, senseGrant)
  }

  for (const spellGrant of bundle.grants.spells) {
    await upsertSpellGrant(context.db, spellGrant)
  }

  for (const background of bundle.subjects.backgrounds) {
    await upsertBackground(context.db, background, context.systemId)
  }

  for (const characterClass of bundle.subjects.classes) {
    await upsertClass(context.db, characterClass, context.systemId)
  }

  for (const equipment of bundle.subjects.equipment) {
    await upsertEquipment(context.db, equipment, context.systemId)
  }

  for (const feat of bundle.subjects.feats) {
    await upsertFeat(context.db, feat, context.systemId)
  }

  for (const race of bundle.subjects.races) {
    await upsertRace(context.db, race, context.systemId)
  }

  for (const spell of bundle.subjects.spells) {
    await upsertSpell(context.db, spell, context.systemId)
  }

  const result: SeedResult = {
    systems: bundle.vocabulary.systems.length,
    sharedRecords:
      bundle.shared.details.length +
      bundle.shared.charges.length +
      bundle.shared.savingThrows.length +
      bundle.shared.startingEquipment.length,
    effects: bundle.effects.effects.length,
    features:
      bundle.features.features.length +
      bundle.features.options.length,
    grants:
      bundle.grants.feats.length +
      bundle.grants.modifiers.length +
      bundle.grants.proficiencies.length +
      bundle.grants.senses.length +
      bundle.grants.spells.length,
    subjects:
      bundle.subjects.backgrounds.length +
      bundle.subjects.classes.length +
      bundle.subjects.equipment.length +
      bundle.subjects.feats.length +
      bundle.subjects.races.length +
      bundle.subjects.spells.length
  }

  return result
}


