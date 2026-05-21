import {
  upsertBackground,
  upsertCharge,
  upsertClass,
  upsertClassRoot,
  upsertCreature,
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
  upsertSystem,
  upsertVehicle
} from '../domains/index.js'
import { createAuthoredRouteIdRepository } from '../repositories/index.js'
import type {
  SeedBaselineContent,
  SeedContext,
  SeedResult
} from './contracts.js'

type BaselineSubjectTable =
  | 'backgrounds'
  | 'classes'
  | 'creatures'
  | 'equipment'
  | 'feats'
  | 'races'
  | 'spells'
  | 'vehicles'

type BaselineSubjectKind =
  | 'BACKGROUND'
  | 'CLASS'
  | 'CREATURE'
  | 'EQUIPMENT'
  | 'FEAT'
  | 'RACE'
  | 'SPELL'
  | 'VEHICLE'

async function markBaselineSubjectsMaster(
  context: SeedContext,
  table: BaselineSubjectTable,
  ids: string[]
) {
  if (ids.length === 0) return

  await context.db
    .updateTable(table)
    .set({ is_master: true })
    .where('id', 'in', ids)
    .execute()
}

async function seedBaselineSubjectRouteIds(
  context: SeedContext,
  subjects: readonly {
    subjectKind: BaselineSubjectKind
    subjectId: string
  }[]
) {
  if (subjects.length === 0) return

  await createAuthoredRouteIdRepository(context.db).seedSrdSubjects(subjects)
}

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

  for (const equipment of bundle.subjects.equipment) {
    await upsertEquipment(context.db, equipment, context.systemId)
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
    await upsertClassRoot(context.db, characterClass, context.systemId)
  }

  for (const spell of bundle.subjects.spells) {
    await upsertSpell(context.db, spell, context.systemId)
  }

  for (const characterClass of bundle.subjects.classes) {
    await upsertClass(context.db, characterClass, context.systemId)
  }

  for (const creature of bundle.subjects.creatures) {
    await upsertCreature(context.db, creature, context.systemId)
  }

  for (const feat of bundle.subjects.feats) {
    await upsertFeat(context.db, feat, context.systemId)
  }

  for (const race of bundle.subjects.races) {
    await upsertRace(context.db, race, context.systemId)
  }

  for (const vehicle of bundle.subjects.vehicles) {
    await upsertVehicle(context.db, vehicle, context.systemId)
  }

  await markBaselineSubjectsMaster(context, 'backgrounds', bundle.subjects.backgrounds.map((record) => record.id))
  await markBaselineSubjectsMaster(context, 'classes', bundle.subjects.classes.map((record) => record.id))
  await markBaselineSubjectsMaster(context, 'creatures', bundle.subjects.creatures.map((record) => record.id))
  await markBaselineSubjectsMaster(context, 'equipment', bundle.subjects.equipment.map((record) => record.id))
  await markBaselineSubjectsMaster(context, 'feats', bundle.subjects.feats.map((record) => record.id))
  await markBaselineSubjectsMaster(context, 'races', bundle.subjects.races.map((record) => record.id))
  await markBaselineSubjectsMaster(context, 'spells', bundle.subjects.spells.map((record) => record.id))
  await markBaselineSubjectsMaster(context, 'vehicles', bundle.subjects.vehicles.map((record) => record.id))

  await seedBaselineSubjectRouteIds(context, [
    ...bundle.subjects.backgrounds.map((record) => ({ subjectKind: 'BACKGROUND' as const, subjectId: record.id })),
    ...bundle.subjects.classes.map((record) => ({ subjectKind: 'CLASS' as const, subjectId: record.id })),
    ...bundle.subjects.creatures.map((record) => ({ subjectKind: 'CREATURE' as const, subjectId: record.id })),
    ...bundle.subjects.equipment.map((record) => ({ subjectKind: 'EQUIPMENT' as const, subjectId: record.id })),
    ...bundle.subjects.feats.map((record) => ({ subjectKind: 'FEAT' as const, subjectId: record.id })),
    ...bundle.subjects.races.map((record) => ({ subjectKind: 'RACE' as const, subjectId: record.id })),
    ...bundle.subjects.spells.map((record) => ({ subjectKind: 'SPELL' as const, subjectId: record.id })),
    ...bundle.subjects.vehicles.map((record) => ({ subjectKind: 'VEHICLE' as const, subjectId: record.id }))
  ])

  const result: SeedResult = {
    systems: bundle.vocabulary.systems.length,
    sharedRecords: [
      bundle.shared.details,
      bundle.shared.charges,
      bundle.shared.savingThrows,
      bundle.shared.startingEquipment
    ].reduce((total, records) => total + records.length, 0),
    effects: bundle.effects.effects.length,
    features: [
      bundle.features.features,
      bundle.features.options
    ].reduce((total, records) => total + records.length, 0),
    grants: [
      bundle.grants.feats,
      bundle.grants.modifiers,
      bundle.grants.proficiencies,
      bundle.grants.senses,
      bundle.grants.spells
    ].reduce((total, records) => total + records.length, 0),
    subjects: [
      bundle.subjects.backgrounds,
      bundle.subjects.classes,
      bundle.subjects.creatures,
      bundle.subjects.equipment,
      bundle.subjects.feats,
      bundle.subjects.races,
      bundle.subjects.spells,
      bundle.subjects.vehicles
    ].reduce((total, records) => total + records.length, 0)
  }

  return result
}
