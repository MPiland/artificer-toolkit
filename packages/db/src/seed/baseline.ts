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
import type { BaselineContentBundle } from '../source-data/content.js'
import { withTransaction } from '../utils/index.js'
import type { SeedBaselineContent, SeedContext, SeedResult } from './contracts.js'

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

interface BaselineSubjectSet {
  table: BaselineSubjectTable
  subjectKind: BaselineSubjectKind
  ids: string[]
}

interface StaleBaselineSubjectSet extends BaselineSubjectSet {
  ids: string[]
}

function getBaselineSubjectSets(bundle: BaselineContentBundle): BaselineSubjectSet[] {
  return [
    {
      table: 'backgrounds',
      subjectKind: 'BACKGROUND',
      ids: bundle.subjects.backgrounds.map((record) => record.id)
    },
    {
      table: 'classes',
      subjectKind: 'CLASS',
      ids: bundle.subjects.classes.map((record) => record.id)
    },
    {
      table: 'creatures',
      subjectKind: 'CREATURE',
      ids: bundle.subjects.creatures.map((record) => record.id)
    },
    {
      table: 'equipment',
      subjectKind: 'EQUIPMENT',
      ids: bundle.subjects.equipment.map((record) => record.id)
    },
    { table: 'feats', subjectKind: 'FEAT', ids: bundle.subjects.feats.map((record) => record.id) },
    { table: 'races', subjectKind: 'RACE', ids: bundle.subjects.races.map((record) => record.id) },
    {
      table: 'spells',
      subjectKind: 'SPELL',
      ids: bundle.subjects.spells.map((record) => record.id)
    },
    {
      table: 'vehicles',
      subjectKind: 'VEHICLE',
      ids: bundle.subjects.vehicles.map((record) => record.id)
    }
  ]
}

function getBaselineRouteSubjects(bundle: BaselineContentBundle) {
  return getBaselineSubjectSets(bundle).flatMap(({ subjectKind, ids }) =>
    ids.map((subjectId) => ({ subjectKind, subjectId }))
  )
}

async function findStaleBaselineSubjectIds(
  context: SeedContext,
  subject: BaselineSubjectSet
): Promise<string[]> {
  let query = context.db
    .selectFrom(subject.table)
    .select('id')
    .where('system_id', '=', context.systemId)
    .where('is_master', '=', true)

  if (subject.ids.length > 0) {
    query = query.where('id', 'not in', subject.ids)
  }

  return (await query.execute()).map((row) => row.id)
}

async function clearStaleBaselineReferences(
  context: SeedContext,
  staleByKind: ReadonlyMap<BaselineSubjectKind, readonly string[]>
): Promise<void> {
  // These RESTRICT-style links must not keep removed baseline roots alive.
  // Later bundle upserts recreate valid links and surface invalid references.
  const staleEquipmentIds = staleByKind.get('EQUIPMENT') ?? []
  if (staleEquipmentIds.length > 0) {
    await context.db
      .deleteFrom('equipment_contains')
      .where('contained_equipment_id', 'in', staleEquipmentIds)
      .execute()
    await context.db
      .deleteFrom('starting_equipment_option_item_equipment')
      .where('equipment_id', 'in', staleEquipmentIds)
      .execute()
    await context.db
      .deleteFrom('proficiency_grant_equipment')
      .where('equipment_id', 'in', staleEquipmentIds)
      .execute()
  }

  const staleClassIds = staleByKind.get('CLASS') ?? []
  if (staleClassIds.length > 0) {
    await context.db.deleteFrom('spell_classes').where('class_id', 'in', staleClassIds).execute()
  }

  const staleFeatIds = staleByKind.get('FEAT') ?? []
  if (staleFeatIds.length > 0) {
    await context.db.deleteFrom('feat_grant_feats').where('feat_id', 'in', staleFeatIds).execute()
    await context.db
      .deleteFrom('feat_grant_scaling_level_feats')
      .where('feat_id', 'in', staleFeatIds)
      .execute()
  }

  const staleSpellIds = staleByKind.get('SPELL') ?? []
  if (staleSpellIds.length > 0) {
    await context.db
      .deleteFrom('spell_grant_spells')
      .where('spell_id', 'in', staleSpellIds)
      .execute()
    await context.db
      .deleteFrom('spell_grant_scaling_level_spells')
      .where('spell_id', 'in', staleSpellIds)
      .execute()
  }
}

async function pruneStaleBaselineSubjects(
  context: SeedContext,
  subjects: readonly BaselineSubjectSet[]
): Promise<void> {
  const staleSubjects: StaleBaselineSubjectSet[] = []

  for (const subject of subjects) {
    staleSubjects.push({
      ...subject,
      ids: await findStaleBaselineSubjectIds(context, subject)
    })
  }

  await clearStaleBaselineReferences(
    context,
    new Map(staleSubjects.map((subject) => [subject.subjectKind, subject.ids]))
  )

  for (const subject of staleSubjects) {
    if (subject.ids.length === 0) continue

    await context.db
      .deleteFrom(subject.table)
      .where('system_id', '=', context.systemId)
      .where('is_master', '=', true)
      .where('id', 'in', subject.ids)
      .execute()
    await context.db
      .deleteFrom('authored_route_ids')
      .where('subject_kind', '=', subject.subjectKind)
      .where('subject_id', 'in', subject.ids)
      .execute()
  }
}

export function pruneStaleBaselineContent(
  context: SeedContext,
  bundle: BaselineContentBundle
): Promise<void> {
  return pruneStaleBaselineSubjects(context, getBaselineSubjectSets(bundle))
}

async function markBaselineSubjectsMaster(
  context: SeedContext,
  table: BaselineSubjectTable,
  ids: string[]
) {
  if (ids.length === 0) return

  await context.db.updateTable(table).set({ is_master: true }).where('id', 'in', ids).execute()
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
const seedBaselineContentInTransaction: SeedBaselineContent = async (context, bundle) => {
  if (!bundle.vocabulary.systems.some((system) => system.id === context.systemId)) {
    throw new Error(`Missing system seed record for systemId "${context.systemId}".`)
  }

  for (const system of bundle.vocabulary.systems) {
    await upsertSystem(context.db, system)
  }

  await pruneStaleBaselineContent(context, bundle)

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

  await markBaselineSubjectsMaster(
    context,
    'backgrounds',
    bundle.subjects.backgrounds.map((record) => record.id)
  )
  await markBaselineSubjectsMaster(
    context,
    'classes',
    bundle.subjects.classes.map((record) => record.id)
  )
  await markBaselineSubjectsMaster(
    context,
    'creatures',
    bundle.subjects.creatures.map((record) => record.id)
  )
  await markBaselineSubjectsMaster(
    context,
    'equipment',
    bundle.subjects.equipment.map((record) => record.id)
  )
  await markBaselineSubjectsMaster(
    context,
    'feats',
    bundle.subjects.feats.map((record) => record.id)
  )
  await markBaselineSubjectsMaster(
    context,
    'races',
    bundle.subjects.races.map((record) => record.id)
  )
  await markBaselineSubjectsMaster(
    context,
    'spells',
    bundle.subjects.spells.map((record) => record.id)
  )
  await markBaselineSubjectsMaster(
    context,
    'vehicles',
    bundle.subjects.vehicles.map((record) => record.id)
  )

  await seedBaselineSubjectRouteIds(context, getBaselineRouteSubjects(bundle))

  const result: SeedResult = {
    systems: bundle.vocabulary.systems.length,
    domainRoots: [
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

export const seedBaselineContent: SeedBaselineContent = (context, bundle) =>
  withTransaction(context.db, (db) => seedBaselineContentInTransaction({ ...context, db }, bundle))
