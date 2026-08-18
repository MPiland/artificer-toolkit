import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import { sql } from 'kysely'
import type { ZodType } from 'zod'

import { type AuthoredSubjectKind } from '@artificer-toolkit/schema/projections/identity'
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
  compileVehicle,
  resolveEquipmentAuthored,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored, RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { createDb } from '../client.js'
import type { DBLike } from '../types/index.js'
import { createAuthoredVersionRepository } from '../repositories/index.js'
import { assignBaselineContentOwner } from '../source-data/content.js'
import { SRD_SYSTEM_ID, srdBaselineContent } from '../source-data/srd/index.js'
type Db = DBLike

interface InactiveMasterRow {
  tableName: string
  id: string
  label: string
  status: string
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
  subjectKind: AuthoredSubjectKind
  records: readonly RootAuditRecord[]
  schema: ZodType<unknown>
  compile: (id: string) => unknown
  parentSubjectId?: (id: string) => string | null
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

function tableRef(tableName: string) {
  return sql.raw(`public.${tableName}`)
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
  const authoredVersionRepository = createAuthoredVersionRepository(db)
  const equipmentById = new Map(
    bundle.subjects.equipment.map(
      (record) => [record.id, equipmentAuthoredDtoSchema.parse(record) as EquipmentAuthored] as const
    )
  )
  const raceById = new Map(
    bundle.subjects.races.map(
      (record) =>
        [record.id, raceAuthoredDtoSchema.parse(record) as unknown as RaceAuthored] as const
    )
  )
  const cases: RootDomainCase[] = [
    {
      domain: 'backgrounds',
      table: 'backgrounds',
      subjectKind: 'BACKGROUND',
      records: bundle.subjects.backgrounds,
      schema: backgroundAuthoredDtoSchema,
      compile: (id) => compileBackground(requireRootRecord(bundle.subjects.backgrounds, id))
    },
    {
      domain: 'classes',
      table: 'classes',
      subjectKind: 'CLASS',
      records: bundle.subjects.classes,
      schema: classAuthoredDtoSchema,
      compile: (id) => compileClass(requireRootRecord(bundle.subjects.classes, id))
    },
    {
      domain: 'creatures',
      table: 'creatures',
      subjectKind: 'CREATURE',
      records: bundle.subjects.creatures,
      schema: creatureAuthoredDtoSchema,
      compile: (id) => compileCreature(requireRootRecord(bundle.subjects.creatures, id))
    },
    {
      domain: 'equipment',
      table: 'equipment',
      subjectKind: 'EQUIPMENT',
      records: bundle.subjects.equipment,
      schema: equipmentAuthoredDtoSchema,
      compile: (id) => {
        const equipment = equipmentById.get(id)
        if (!equipment) throw new Error(`Source equipment "${id}" was not found.`)
        return compileEquipment(
          resolveEquipmentAuthored(equipment, (parentId) => equipmentById.get(parentId) ?? null)
        )
      },
      parentSubjectId: (id) => {
        const equipment = equipmentById.get(id)
        return equipment?.category === 'VARIANT' ? equipment.parentEquipmentId : null
      }
    },
    {
      domain: 'feats',
      table: 'feats',
      subjectKind: 'FEAT',
      records: bundle.subjects.feats,
      schema: featAuthoredDtoSchema,
      compile: (id) => compileFeat(requireRootRecord(bundle.subjects.feats, id))
    },
    {
      domain: 'races',
      table: 'races',
      subjectKind: 'RACE',
      records: bundle.subjects.races,
      schema: raceAuthoredDtoSchema,
      compile: (id) => {
        const race = raceById.get(id)
        if (!race) throw new Error(`Source race "${id}" was not found.`)
        return compileRace(resolveRaceAuthored(race, (parentId) => raceById.get(parentId) ?? null))
      },
      parentSubjectId: (id) => {
        const race = raceById.get(id)
        return race?.category === 'SUBRACE' ? race.parentRaceId : null
      }
    },
    {
      domain: 'spells',
      table: 'spells',
      subjectKind: 'SPELL',
      records: bundle.subjects.spells,
      schema: spellAuthoredDtoSchema,
      compile: (id) => compileSpell(requireRootRecord(bundle.subjects.spells, id))
    },
    {
      domain: 'vehicles',
      table: 'vehicles',
      subjectKind: 'VEHICLE',
      records: bundle.subjects.vehicles,
      schema: vehicleAuthoredDtoSchema,
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
    const rootEnvelopeResult = await sql<{ id: string }>`
      select id::text
      from ${tableRef(domainCase.table)}
      where system_id = ${SRD_SYSTEM_ID}::uuid
        and is_master is true
    `.execute(db)
    const rootEnvelopeIds = new Set(rootEnvelopeResult.rows.map((row) => row.id))
    const expectedIds = new Set(domainCase.records.map((record) => record.id))

    for (const unexpectedId of rootEnvelopeIds) {
      if (expectedIds.has(unexpectedId)) continue

      issues.push({
        domain: domainCase.domain,
        id: unexpectedId,
        label: '<unexpected master root envelope>',
        issue: 'root envelope is absent from the SRD source corpus'
      })
    }

    for (let offset = 0; offset < domainCase.records.length; offset += 5) {
      const batch = domainCase.records.slice(offset, offset + 5)
      await Promise.all(
        batch.map(async (record) => {
          if (!rootEnvelopeIds.has(record.id)) {
            issues.push({
              domain: domainCase.domain,
              id: record.id,
              label: record.label,
              issue: 'missing master root envelope'
            })
            return
          }

          try {
            const activeVersions = await authoredVersionRepository.findActiveByIds({
              subjectIds: [record.id],
              subjectKind: domainCase.subjectKind,
              systemId: SRD_SYSTEM_ID,
              userId: ownerUserId,
              includeMaster: true
            })
            const active = activeVersions.get(record.id)
            if (!active) {
              issues.push({
                domain: domainCase.domain,
                id: record.id,
                label: record.label,
                issue: 'missing active immutable version'
              })
              return
            }

            const parsed = domainCase.schema.safeParse(active.authored.document)
            if (!parsed.success) {
              issues.push({
                domain: domainCase.domain,
                id: record.id,
                label: record.label,
                issue: `active authored document violates schema: ${parsed.error.issues.map((entry) => entry.message).join('; ')}`
              })
            } else {
              if (!isDeepStrictEqual(canonicalize(active.authored.document), canonicalize(record))) {
                issues.push({
                  domain: domainCase.domain,
                  id: record.id,
                  label: record.label,
                  issue: 'active authored document differs from source payload',
                  paths: listDifferencePaths(record, active.authored.document)
                })
              }

              const parentSubjectId = domainCase.parentSubjectId?.(record.id)
              if (parentSubjectId) {
                const parent = await authoredVersionRepository.findActive({
                  subjectKind: domainCase.subjectKind,
                  subjectId: parentSubjectId
                })
                const [dependency] = active.compiled.authoredDependencies
                const dependencyMatches =
                  active.compiled.authoredDependencies.length === 1 &&
                  parent !== null &&
                  dependency?.subjectKind === parent.authored.subjectKind &&
                  dependency.subjectId === parent.authored.subjectId &&
                  dependency.versionId === parent.authored.versionId &&
                  dependency.version === parent.authored.version &&
                  dependency.checksum === parent.authored.checksum
                if (!dependencyMatches) {
                  issues.push({
                    domain: domainCase.domain,
                    id: record.id,
                    label: record.label,
                    issue: 'compiled projection does not pin the active source parent version'
                  })
                }
              }

              try {
                const rebuiltProjection = await domainCase.compile(record.id)
                if (
                  !isDeepStrictEqual(
                    canonicalize(active.compiled.projection),
                    canonicalize(rebuiltProjection)
                  )
                ) {
                  issues.push({
                    domain: domainCase.domain,
                    id: record.id,
                    label: record.label,
                    issue: 'compiled projection differs from deterministic source rebuild',
                    paths: listDifferencePaths(rebuiltProjection, active.compiled.projection)
                  })
                }
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
              issue: `versioned projection read failed: ${error instanceof Error ? error.message : String(error)}`
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
  const [inactiveMasterRows, rootCorpus, sourceSemantics] = await Promise.all([
    listInactiveMasterRows(db),
    auditRootCorpus(db),
    Promise.resolve(auditSourceSemantics())
  ])

  return {
    inactiveMasterRows,
    rootCorpus,
    sourceSemantics
  }
}

export function hasSrdAuditIssues(summary: Awaited<ReturnType<typeof auditSrdData>>): boolean {
  return (
    summary.inactiveMasterRows.length > 0 ||
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
