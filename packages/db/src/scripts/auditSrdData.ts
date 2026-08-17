import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import { sql } from 'kysely'
import type { ZodType } from 'zod'

import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import {
  compileBackground,
  compileClass,
  compileCreature,
  compileEquipment,
  compileFeat,
  compileRace,
  compileSpell,
  compileVehicle
} from '@artificer-toolkit/shared/compilers'

import { createDb } from '../client.js'
import type { DBLike } from '../types/index.js'
import {
  createBackgroundRepository,
  createClassRepository,
  createCreatureRepository,
  createEquipmentRepository,
  createFeatRepository,
  createRaceRepository,
  createSpellRepository,
  createVehicleRepository
} from '../repositories/index.js'
import { assignBaselineContentOwner } from '../source-data/content.js'
import { SRD_SYSTEM_ID, srdBaselineContent } from '../source-data/srd/index.js'
type Db = DBLike

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

interface RootCorpusIssue {
  domain: string
  id: string
  label: string
  issue: string
  paths?: string[]
}

interface RootAuditRecord {
  id: string
  label: string
}

interface RootDomainCase {
  domain: string
  table: (typeof subjectTables)[number]
  records: readonly RootAuditRecord[]
  schema: ZodType<unknown>
  findById: (id: string) => Promise<unknown>
  compile: (id: string) => unknown
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

function canonicalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

function requireRootRecord<T extends RootAuditRecord>(records: readonly T[], id: string): T {
  const record = records.find((candidate) => candidate.id === id)
  if (!record) throw new Error(`Source record "${id}" was not found.`)
  return record
}

function listDifferencePaths(expected: unknown, actual: unknown): string[] {
  const differences: string[] = []

  const visit = (expectedValue: unknown, actualValue: unknown, path: string) => {
    if (differences.length >= 12 || isDeepStrictEqual(expectedValue, actualValue)) return

    if (Array.isArray(expectedValue) && Array.isArray(actualValue)) {
      const length = Math.max(expectedValue.length, actualValue.length)
      for (let index = 0; index < length; index += 1) {
        visit(expectedValue[index], actualValue[index], `${path}[${index}]`)
      }
      return
    }

    if (isRecord(expectedValue) && isRecord(actualValue)) {
      const keys = new Set([...Object.keys(expectedValue), ...Object.keys(actualValue)])
      for (const key of [...keys].sort()) {
        visit(expectedValue[key], actualValue[key], `${path}.${key}`)
      }
      return
    }

    differences.push(path)
  }

  visit(canonicalize(expected), canonicalize(actual), '$')
  return differences
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
    value.effectKind === 'DAMAGE' ||
    value.bonusKind ||
    value.rangeKind === 'DISTANCE' ||
    value.durationKind
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
      const record =
        subject.subjectKind === 'equipment'
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

async function auditRootCorpus(db: Db): Promise<RootCorpusIssue[]> {
  const systemResult = await sql<{ user_id: string | null }>`
    select user_id::text
    from systems
    where id = ${SRD_SYSTEM_ID}::uuid
    limit 1
  `.execute(db)
  const ownerUserId = systemResult.rows[0]?.user_id
  if (!ownerUserId) {
    return [
      {
        domain: 'systems',
        id: SRD_SYSTEM_ID,
        label: 'D&D 5e 2014 SRD',
        issue: 'missing SRD system or seed owner'
      }
    ]
  }

  const bundle = assignBaselineContentOwner(srdBaselineContent, ownerUserId)
  const backgroundRepository = createBackgroundRepository(db)
  const classRepository = createClassRepository(db)
  const creatureRepository = createCreatureRepository(db)
  const equipmentRepository = createEquipmentRepository(db)
  const featRepository = createFeatRepository(db)
  const raceRepository = createRaceRepository(db)
  const spellRepository = createSpellRepository(db)
  const vehicleRepository = createVehicleRepository(db)
  const cases: RootDomainCase[] = [
    {
      domain: 'backgrounds',
      table: 'backgrounds',
      records: bundle.subjects.backgrounds,
      schema: backgroundAuthoredDtoSchema,
      findById: (id) => backgroundRepository.findById(id),
      compile: (id) => compileBackground(requireRootRecord(bundle.subjects.backgrounds, id))
    },
    {
      domain: 'classes',
      table: 'classes',
      records: bundle.subjects.classes,
      schema: classAuthoredDtoSchema,
      findById: (id) => classRepository.findById(id),
      compile: (id) => compileClass(requireRootRecord(bundle.subjects.classes, id))
    },
    {
      domain: 'creatures',
      table: 'creatures',
      records: bundle.subjects.creatures,
      schema: creatureAuthoredDtoSchema,
      findById: (id) => creatureRepository.findById(id),
      compile: (id) => compileCreature(requireRootRecord(bundle.subjects.creatures, id))
    },
    {
      domain: 'equipment',
      table: 'equipment',
      records: bundle.subjects.equipment,
      schema: equipmentAuthoredDtoSchema,
      findById: (id) => equipmentRepository.findById(id),
      compile: (id) => compileEquipment(requireRootRecord(bundle.subjects.equipment, id))
    },
    {
      domain: 'feats',
      table: 'feats',
      records: bundle.subjects.feats,
      schema: featAuthoredDtoSchema,
      findById: (id) => featRepository.findById(id),
      compile: (id) => compileFeat(requireRootRecord(bundle.subjects.feats, id))
    },
    {
      domain: 'races',
      table: 'races',
      records: bundle.subjects.races,
      schema: raceAuthoredDtoSchema,
      findById: (id) => raceRepository.findById(id),
      compile: async (id) => {
        const resolved = await raceRepository.findResolvedById(id)
        if (!resolved) throw new Error('resolved race was not found')
        return compileRace(resolved)
      }
    },
    {
      domain: 'spells',
      table: 'spells',
      records: bundle.subjects.spells,
      schema: spellAuthoredDtoSchema,
      findById: (id) => spellRepository.findById(id),
      compile: (id) => compileSpell(requireRootRecord(bundle.subjects.spells, id))
    },
    {
      domain: 'vehicles',
      table: 'vehicles',
      records: bundle.subjects.vehicles,
      schema: vehicleAuthoredDtoSchema,
      findById: (id) => vehicleRepository.findById(id),
      compile: (id) => compileVehicle(requireRootRecord(bundle.subjects.vehicles, id))
    }
  ]
  const expectedById = new Map(
    cases.flatMap((domainCase) => {
      return domainCase.records.map(
        (record) => [record.id, { domain: domainCase.domain, record }] as const
      )
    })
  )
  const routeResult = await sql<{ subject_id: string }>`
    with master_roots as (
      select 'BACKGROUND'::text as subject_kind, id as subject_id
      from backgrounds where system_id = ${SRD_SYSTEM_ID}::uuid and is_master is true
      union all
      select 'CLASS', id from classes where system_id = ${SRD_SYSTEM_ID}::uuid and is_master is true
      union all
      select 'CREATURE', id from creatures where system_id = ${SRD_SYSTEM_ID}::uuid and is_master is true
      union all
      select 'EQUIPMENT', id from equipment where system_id = ${SRD_SYSTEM_ID}::uuid and is_master is true
      union all
      select 'FEAT', id from feats where system_id = ${SRD_SYSTEM_ID}::uuid and is_master is true
      union all
      select 'RACE', id from races where system_id = ${SRD_SYSTEM_ID}::uuid and is_master is true
      union all
      select 'SPELL', id from spells where system_id = ${SRD_SYSTEM_ID}::uuid and is_master is true
      union all
      select 'VEHICLE', id from vehicles where system_id = ${SRD_SYSTEM_ID}::uuid and is_master is true
    )
    select route.subject_id::text
    from authored_route_ids route
    join master_roots root
      on root.subject_id = route.subject_id
      and root.subject_kind = route.subject_kind
  `.execute(db)
  const routeIds = new Set(routeResult.rows.map((row) => row.subject_id))
  const issues: RootCorpusIssue[] = []

  for (const domainCase of cases) {
    const projectionResult = await sql<{ id: string }>`
      select id::text
      from ${tableRef(domainCase.table)}
      where system_id = ${SRD_SYSTEM_ID}::uuid
        and is_master is true
    `.execute(db)
    const projectionIds = new Set(projectionResult.rows.map((row) => row.id))
    const expectedIds = new Set(domainCase.records.map((record) => record.id))

    for (const unexpectedId of projectionIds) {
      if (expectedIds.has(unexpectedId)) continue

      issues.push({
        domain: domainCase.domain,
        id: unexpectedId,
        label: '<unexpected master projection>',
        issue: 'projection is absent from the SRD source corpus'
      })
    }

    for (let offset = 0; offset < domainCase.records.length; offset += 5) {
      const batch = domainCase.records.slice(offset, offset + 5)
      await Promise.all(
        batch.map(async (record) => {
          if (!projectionIds.has(record.id)) {
            issues.push({
              domain: domainCase.domain,
              id: record.id,
              label: record.label,
              issue: 'missing master projection'
            })
            return
          }

          try {
            const hydrated = await domainCase.findById(record.id)
            const parsed = domainCase.schema.safeParse(hydrated)
            if (!parsed.success) {
              issues.push({
                domain: domainCase.domain,
                id: record.id,
                label: record.label,
                issue: `hydrated projection violates schema: ${parsed.error.issues.map((entry) => entry.message).join('; ')}`
              })
            } else {
              if (!isDeepStrictEqual(canonicalize(hydrated), canonicalize(record))) {
                issues.push({
                  domain: domainCase.domain,
                  id: record.id,
                  label: record.label,
                  issue: 'hydrated projection differs from source payload',
                  paths: listDifferencePaths(record, hydrated)
                })
              }

              try {
                await domainCase.compile(record.id)
              } catch (error) {
                issues.push({
                  domain: domainCase.domain,
                  id: record.id,
                  label: record.label,
                  issue: `compiler failed: ${error instanceof Error ? error.message : String(error)}`
                })
              }
            }
          } catch (error) {
            issues.push({
              domain: domainCase.domain,
              id: record.id,
              label: record.label,
              issue: `hydration failed: ${error instanceof Error ? error.message : String(error)}`
            })
          }

          if (!routeIds.has(record.id)) {
            issues.push({
              domain: domainCase.domain,
              id: record.id,
              label: record.label,
              issue: 'missing authored route identity'
            })
          }
        })
      )
    }
  }

  for (const routeId of routeIds) {
    if (!expectedById.has(routeId)) {
      issues.push({
        domain: 'routes',
        id: routeId,
        label: '<unexpected master route>',
        issue: 'route identity is absent from the SRD source corpus'
      })
    }
  }

  return issues
}

function auditSourceSemantics(): RootCorpusIssue[] {
  const issues: RootCorpusIssue[] = []
  const classes = srdBaselineContent.subjects.classes
  const baseClasses = classes.filter((record) => record.category === 'BASE')
  const subclasses = classes.filter((record) => record.category === 'SUBCLASS')
  const equipment = srdBaselineContent.subjects.equipment
  const equipmentIds = new Set(equipment.map((record) => record.id))

  if (baseClasses.length !== 12) {
    issues.push({
      domain: 'classes',
      id: '<base-class-count>',
      label: 'Base classes',
      issue: `expected 12 base classes but found ${baseClasses.length}`
    })
  }

  for (const baseClass of baseClasses) {
    if (baseClass.startingEquipment.sets.length === 0) {
      issues.push({
        domain: 'classes',
        id: baseClass.id,
        label: baseClass.label,
        issue: 'base class has no starting equipment set'
      })
    }

    if (
      subclasses.some((record) => record.parentClassId === baseClass.id) &&
      baseClass.subclassSelectionLevel === undefined
    ) {
      issues.push({
        domain: 'classes',
        id: baseClass.id,
        label: baseClass.label,
        issue: 'base class has subclasses but no subclass selection level'
      })
    }

    for (const set of baseClass.startingEquipment.sets) {
      for (const group of set.groups) {
        if (group.options.length === 0) {
          issues.push({
            domain: 'classes',
            id: baseClass.id,
            label: baseClass.label,
            issue: `starting equipment group ${group.id} has no options`
          })
        }

        for (const option of group.options) {
          for (const item of option.items) {
            if (item.startingEquipmentKind !== 'EQUIPMENT') continue
            if (!('authoringModeKind' in item)) continue

            if (item.authoringModeKind === 'SELECTED') {
              const missingEquipmentIds = item.equipmentIds.filter((id) => !equipmentIds.has(id))
              if (missingEquipmentIds.length > 0) {
                issues.push({
                  domain: 'classes',
                  id: baseClass.id,
                  label: baseClass.label,
                  issue: `starting equipment item ${item.id} references missing equipment`,
                  paths: missingEquipmentIds
                })
              }
              continue
            }

            const hasCandidate = equipment.some(
              (candidate) =>
                (!item.category || candidate.category === item.category) &&
                (!item.properties?.length ||
                  item.properties.every((property) => candidate.properties?.includes(property)))
            )
            if (!hasCandidate) {
              issues.push({
                domain: 'classes',
                id: baseClass.id,
                label: baseClass.label,
                issue: `starting equipment item ${item.id} has no matching equipment candidate`
              })
            }
          }
        }
      }
    }
  }

  const wizard = baseClasses.find((record) => record.label === 'Wizard')
  const wizardLevel20 = wizard?.spellcasting?.spellLimits.find((limit) => limit.classLevel === 20)
  if (wizardLevel20?.learnedSpellsLimit !== 44) {
    issues.push({
      domain: 'classes',
      id: wizard?.id ?? '<wizard>',
      label: 'Wizard',
      issue: `expected level-20 learned spell limit 44 but found ${wizardLevel20?.learnedSpellsLimit ?? 'none'}`
    })
  }

  const cleric = baseClasses.find((record) => record.label === 'Cleric')
  const clericEligibilityPredicates =
    cleric?.startingEquipment.sets.flatMap((set) =>
      set.groups.flatMap((group) =>
        group.options.flatMap(
          (option) =>
            option.eligibility?.groups.flatMap((facetGroup) =>
              facetGroup.contexts.flatMap((context) =>
                (context.conditions ?? []).flatMap((condition) =>
                  condition.kind === 'PREDICATE' ? [condition.predicateCode] : []
                )
              )
            ) ?? []
        )
      )
    ) ?? []
  if (
    !clericEligibilityPredicates.includes('EQUIPMENT_PROFICIENCY') ||
    !clericEligibilityPredicates.includes('EQUIPMENT_PROPERTY_PROFICIENCY')
  ) {
    issues.push({
      domain: 'classes',
      id: cleric?.id ?? '<cleric>',
      label: 'Cleric',
      issue: 'conditional starting equipment is missing exact or property proficiency eligibility'
    })
  }

  return issues
}

export async function auditSrdData(db: Db) {
  const [
    inactiveMasterRows,
    orphanFeatureLinks,
    fixedDamageHydration,
    rootCorpus,
    sourceSemantics
  ] = await Promise.all([
    listInactiveMasterRows(db),
    listOrphanFeatureLinks(db),
    auditFixedDamageHydration(db),
    auditRootCorpus(db),
    Promise.resolve(auditSourceSemantics())
  ])

  return {
    inactiveMasterRows,
    orphanFeatureLinks,
    fixedDamageHydration,
    rootCorpus,
    sourceSemantics
  }
}

export function hasSrdAuditIssues(summary: Awaited<ReturnType<typeof auditSrdData>>): boolean {
  return (
    summary.inactiveMasterRows.length > 0 ||
    summary.orphanFeatureLinks.length > 0 ||
    summary.fixedDamageHydration.hydrationFailures.length > 0 ||
    summary.fixedDamageHydration.invalidNumericValues.length > 0 ||
    summary.rootCorpus.length > 0 ||
    summary.sourceSemantics.length > 0
  )
}

async function main() {
  const staging = process.argv.includes('--staging')
  const production = process.argv.includes('--production')
  if (staging && production) throw new Error('Pass at most one of --staging or --production.')
  const variableName = staging
    ? 'STAGING_DATABASE_CONNECTION_STRING'
    : production
      ? 'PROD_DATABASE_CONNECTION_STRING'
      : 'DATABASE_CONNECTION_STRING'
  const connectionString = process.env[variableName]
  if (!connectionString) {
    throw new Error(`${variableName} is required for the SRD data audit.`)
  }
  const db = createDb({ connectionString })

  try {
    const summary = await auditSrdData(db)

    console.info(JSON.stringify(summary, null, 2))

    if (hasSrdAuditIssues(summary)) {
      throw new Error('SRD data audit failed.')
    }
  } finally {
    await db.destroy()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
