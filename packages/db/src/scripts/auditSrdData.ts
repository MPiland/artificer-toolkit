import { sql } from 'kysely'

import { createDb } from '../client.js'
import {
  createCreatureRepository,
  createEquipmentRepository
} from '../repositories/index.js'

type Db = ReturnType<typeof createDb>

interface InactiveMasterRow {
  tableName: string
  id: string
  label: string
  status: string
}

interface OrphanFeatureLink {
  bridge: string
  subjectId: string
  subjectLabel: string
  featureId: string
}

interface FixedDamageSubject {
  subjectKind: 'creature' | 'equipment'
  id: string
  label: string
}

interface HydrationFailure {
  subjectKind: FixedDamageSubject['subjectKind']
  id: string
  label: string
  error: string
}

interface InvalidNumericValue {
  subjectKind: FixedDamageSubject['subjectKind']
  id: string
  label: string
  path: string
  value: unknown
}

const subjectTables = [
  'backgrounds',
  'classes',
  'creatures',
  'equipment',
  'feats',
  'races',
  'spells',
  'vehicles'
] as const

const subjectFeatureBridges = [
  { bridge: 'background_features', subjectTable: 'backgrounds', subjectColumn: 'background_id' },
  { bridge: 'class_features', subjectTable: 'classes', subjectColumn: 'class_id' },
  { bridge: 'creature_features', subjectTable: 'creatures', subjectColumn: 'creature_id' },
  { bridge: 'equipment_features', subjectTable: 'equipment', subjectColumn: 'equipment_id' },
  { bridge: 'feat_features', subjectTable: 'feats', subjectColumn: 'feat_id' },
  { bridge: 'race_features', subjectTable: 'races', subjectColumn: 'race_id' },
  { bridge: 'vehicle_features', subjectTable: 'vehicles', subjectColumn: 'vehicle_id' }
] as const

function tableRef(tableName: string) {
  return sql.raw(`public.${tableName}`)
}

function columnRef(columnName: string) {
  return sql.raw(columnName)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function collectInvalidNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  invalidValues: InvalidNumericValue[],
  subject: FixedDamageSubject
) {
  const entry = value[key]
  if (entry !== undefined && typeof entry !== 'number') {
    invalidValues.push({
      ...subject,
      path: `${path}.${key}`,
      value: entry
    })
  }
}

function collectInvalidHydratedNumerics(
  value: unknown,
  path: string,
  invalidValues: InvalidNumericValue[],
  subject: FixedDamageSubject
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectInvalidHydratedNumerics(item, `${path}[${index}]`, invalidValues, subject)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (
    value.effectKind === 'DAMAGE'
    || value.bonusKind
    || value.rangeKind === 'DISTANCE'
    || value.durationKind
  ) {
    for (const key of ['amount', 'multiplier', 'min', 'max']) {
      collectInvalidNumber(value, key, path, invalidValues, subject)
    }
  }

  for (const key of ['edgeLength', 'height', 'length', 'radius', 'thickness']) {
    const dimension = value[key]
    if (isRecord(dimension)) {
      collectInvalidNumber(dimension, 'amount', `${path}.${key}`, invalidValues, subject)
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    collectInvalidHydratedNumerics(entry, path ? `${path}.${key}` : key, invalidValues, subject)
  }
}

async function listInactiveMasterRows(db: Db): Promise<InactiveMasterRow[]> {
  const rows: InactiveMasterRow[] = []

  for (const tableName of subjectTables) {
    const result = await sql<InactiveMasterRow>`
      select
        ${tableName} as "tableName",
        id::text as id,
        label,
        status
      from ${tableRef(tableName)}
      where is_master is true
        and status <> 'ACTIVE'
      order by label
    `.execute(db)

    rows.push(...result.rows)
  }

  return rows
}

async function listOrphanFeatureLinks(db: Db): Promise<OrphanFeatureLink[]> {
  const rows: OrphanFeatureLink[] = []

  for (const config of subjectFeatureBridges) {
    const result = await sql<OrphanFeatureLink>`
      select
        ${config.bridge} as bridge,
        subject.id::text as "subjectId",
        subject.label as "subjectLabel",
        link.feature_id::text as "featureId"
      from ${tableRef(config.bridge)} link
      join ${tableRef(config.subjectTable)} subject
        on subject.id = link.${columnRef(config.subjectColumn)}
      left join public.features feature
        on feature.id = link.feature_id
      where feature.id is null
      order by subject.label, link.feature_id
    `.execute(db)

    rows.push(...result.rows)
  }

  const ancestryOptionResult = await sql<OrphanFeatureLink>`
    select
      'race_ancestry_option_features' as bridge,
      option.id::text as "subjectId",
      race.label || ' / ' || option.label as "subjectLabel",
      link.feature_id::text as "featureId"
    from public.race_ancestry_option_features link
    join public.race_ancestry_options option
      on option.id = link.ancestry_option_id
    join public.race_ancestries ancestry
      on ancestry.id = option.ancestry_id
    join public.races race
      on race.id = ancestry.race_id
    left join public.features feature
      on feature.id = link.feature_id
    where feature.id is null
    order by race.label, option.label, link.feature_id
  `.execute(db)

  rows.push(...ancestryOptionResult.rows)
  return rows
}

async function listFixedDamageSubjects(db: Db): Promise<FixedDamageSubject[]> {
  const result = await sql<FixedDamageSubject>`
    select distinct
      'equipment' as "subjectKind",
      equipment.id::text as id,
      equipment.label
    from public.damages damage
    join public.damage_values value
      on value.damage_id = damage.id
    join public.effect_result_block_outcomes outcome
      on outcome.outcome_id = damage.id
    join public.effect_result_blocks result_block
      on result_block.id = outcome.result_block_id
    join public.effect_paths path
      on path.result_block_id = result_block.id
    join public.equipment_effects equipment_effect
      on equipment_effect.effect_id = path.effect_id
    join public.equipment equipment
      on equipment.id = equipment_effect.equipment_id
    where damage.value_kind = 'FIXED'
      and damage.scaling_kind = 'NONE'
      and value.amount is not null

    union

    select distinct
      'creature' as "subjectKind",
      creature.id::text as id,
      creature.label
    from public.damages damage
    join public.damage_values value
      on value.damage_id = damage.id
    join public.effect_result_block_outcomes outcome
      on outcome.outcome_id = damage.id
    join public.effect_result_blocks result_block
      on result_block.id = outcome.result_block_id
    join public.effect_paths path
      on path.result_block_id = result_block.id
    join public.feature_effects feature_effect
      on feature_effect.effect_id = path.effect_id
    join public.creature_features creature_feature
      on creature_feature.feature_id = feature_effect.feature_id
    join public.creatures creature
      on creature.id = creature_feature.creature_id
    where damage.value_kind = 'FIXED'
      and damage.scaling_kind = 'NONE'
      and value.amount is not null

    order by "subjectKind", label
  `.execute(db)

  return result.rows
}

async function auditFixedDamageHydration(db: Db) {
  const equipmentRepository = createEquipmentRepository(db)
  const creatureRepository = createCreatureRepository(db)
  const hydrationFailures: HydrationFailure[] = []
  const invalidNumericValues: InvalidNumericValue[] = []

  for (const subject of await listFixedDamageSubjects(db)) {
    try {
      const record = subject.subjectKind === 'equipment'
        ? await equipmentRepository.findById(subject.id)
        : await creatureRepository.findById(subject.id)

      collectInvalidHydratedNumerics(record, subject.subjectKind, invalidNumericValues, subject)
    } catch (error) {
      hydrationFailures.push({
        ...subject,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return {
    hydrationFailures,
    invalidNumericValues
  }
}

async function main() {
  const db = createDb()

  try {
    const [
      inactiveMasterRows,
      orphanFeatureLinks,
      fixedDamageHydration
    ] = await Promise.all([
      listInactiveMasterRows(db),
      listOrphanFeatureLinks(db),
      auditFixedDamageHydration(db)
    ])
    const summary = {
      inactiveMasterRows,
      orphanFeatureLinks,
      fixedDamageHydration
    }

    console.info(JSON.stringify(summary, null, 2))

    if (
      inactiveMasterRows.length > 0
      || orphanFeatureLinks.length > 0
      || fixedDamageHydration.hydrationFailures.length > 0
      || fixedDamageHydration.invalidNumericValues.length > 0
    ) {
      throw new Error('SRD data audit failed.')
    }
  } finally {
    await db.destroy()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
