import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { Pool, type PoolClient } from 'pg'

import { createDb } from '../client.js'
import { seedBaselineContent } from '../seed/baseline.js'
import type { BaselineContentBundle } from '../source-data/content.js'
import { SRD_SYSTEM_ID, srdBaselineContent } from '../source-data/srd/index.js'
import { auditSrdData, hasSrdAuditIssues } from './auditSrdData.js'
import {
  ensureSeedOwnerUser,
  findSeedOwnerUserById,
  readSeedOwnerEnvironment,
  type SeedOwnerEnvironment
} from './seedOwner.js'

const CONFIRM_FLAG = '--confirm-sync-srd-master-corpus'
const ALLOW_LOCAL_TARGET_FLAG = '--allow-local-target'
const DRY_RUN_FLAG = '--dry-run'
const LOCAL_FLAG = '--local'
const INSERT_BATCH_SIZE = 500
const AUTHORED_TABLES = new Set(['authored_definitions', 'authored_definition_revisions'])
const ROOT_TABLES = [
  'backgrounds',
  'classes',
  'creatures',
  'equipment',
  'feats',
  'races',
  'spells',
  'vehicles'
] as const

export interface TableColumn {
  name: string
  type: string
  nullable: boolean
  hasDefault: boolean
}

interface TableShape {
  columns: TableColumn[]
  primaryKey: string[]
}

export interface TableSnapshot extends TableShape {
  name: string
  rows: Record<string, unknown>[]
}

interface ForeignKeyEdge {
  referencing_table: string
  referenced_table: string
}

interface SequenceColumn {
  table_name: string
  column_name: string
  sequence_name: string
}

interface SequenceState extends SequenceColumn {
  maximum_value: string
  has_rows: boolean
}

interface QueryClient {
  query(queryText: string, values?: unknown[]): Promise<unknown>
}

interface AuthoredDefinitionSnapshot {
  subjectId: string
  subjectKind: string
  systemId: string
  label: string
  payload: Record<string, unknown>
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function tableRef(tableName: string): string {
  return `public.${quoteIdentifier(tableName)}`
}

function isLocalDatabaseUrl(connectionString: string): boolean {
  const host = new URL(connectionString).hostname.toLowerCase()
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
}

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]

  if (!value) throw new Error(`${name} is required.`)

  return value
}

function readLocalSourceDatabaseUrl(): string {
  const connectionString = requireEnvironmentVariable('DATABASE_CONNECTION_STRING')

  if (!isLocalDatabaseUrl(connectionString)) {
    throw new Error('DATABASE_CONNECTION_STRING must point to a local database.')
  }

  return connectionString
}

function readProductionSourceDatabaseUrl(): string {
  const connectionString = requireEnvironmentVariable('PROD_LOCAL_CONNECTION_STRING')

  if (!isLocalDatabaseUrl(connectionString)) {
    throw new Error('PROD_LOCAL_CONNECTION_STRING must point to a local database.')
  }

  return connectionString
}

function readSeedOwnerUserId(): string | undefined {
  return process.env.SEED_OWNER_USER_ID
}

async function getSeedOwnerUserId(environment: SeedOwnerEnvironment): Promise<string> {
  const configuredUserId = readSeedOwnerUserId()

  if (configuredUserId) {
    const configuredUser = await findSeedOwnerUserById(environment, configuredUserId)

    if (configuredUser) {
      return configuredUser.id
    }
  }

  const seedOwner = await ensureSeedOwnerUser(environment)
  return seedOwner.id
}

function withSeedOwner(bundle: BaselineContentBundle, userId: string): BaselineContentBundle {
  return {
    ...bundle,
    vocabulary: {
      systems: bundle.vocabulary.systems.map((system) => ({
        ...system,
        userId
      }))
    },
    subjects: {
      backgrounds: bundle.subjects.backgrounds.map((record) => ({ ...record, userId })),
      classes: bundle.subjects.classes.map((record) => ({ ...record, userId })),
      creatures: bundle.subjects.creatures.map((record) => ({ ...record, userId })),
      equipment: bundle.subjects.equipment.map((record) => ({ ...record, userId })),
      feats: bundle.subjects.feats.map((record) => ({ ...record, userId })),
      races: bundle.subjects.races.map((record) => ({ ...record, userId })),
      spells: bundle.subjects.spells.map((record) => ({ ...record, userId })),
      vehicles: bundle.subjects.vehicles.map((record) => ({ ...record, userId }))
    }
  }
}

async function seedLocalSrdCorpus(connectionString: string): Promise<void> {
  const environment = readSeedOwnerEnvironment(false, connectionString)
  const db = createDb({ connectionString })

  try {
    const seedOwnerUserId = await getSeedOwnerUserId(environment)
    const bundle = withSeedOwner(srdBaselineContent, seedOwnerUserId)

    console.info('Seeding normalized local SRD content and authored metadata...')
    const result = await seedBaselineContent(
      {
        db,
        systemId: SRD_SYSTEM_ID
      },
      bundle
    )

    console.info('Seeded local SRD baseline content.')
    console.info(`Seed owner user id: ${seedOwnerUserId}`)
    console.info(JSON.stringify(result, null, 2))
  } finally {
    await db.destroy()
  }
}

function remapOwner<T extends Record<string, unknown>>(
  value: T,
  sourceOwnerId: string,
  targetOwnerId: string
): T {
  if (sourceOwnerId === targetOwnerId) return value
  return JSON.parse(JSON.stringify(value).replaceAll(sourceOwnerId, targetOwnerId)) as T
}

function orderTables(tableNames: readonly string[], edges: readonly ForeignKeyEdge[]): string[] {
  const included = new Set(tableNames)
  const dependencies = new Map(tableNames.map((tableName) => [tableName, new Set<string>()]))

  for (const edge of edges) {
    if (!included.has(edge.referencing_table) || !included.has(edge.referenced_table)) continue
    if (edge.referencing_table === edge.referenced_table) continue
    dependencies.get(edge.referencing_table)?.add(edge.referenced_table)
  }

  const ordered: string[] = []
  const remaining = new Set(tableNames)
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((tableName) =>
        [...(dependencies.get(tableName) ?? [])].every((dependency) => !remaining.has(dependency))
      )
      .sort()

    if (ready.length === 0) {
      ordered.push(...[...remaining].sort())
      break
    }

    for (const tableName of ready) {
      ordered.push(tableName)
      remaining.delete(tableName)
    }
  }

  return ordered
}

async function listCorpusTableNames(client: PoolClient): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name <> 'characters'
      and left(table_name, 10) <> 'character_'
      and table_name <> 'profiles'
    order by table_name
  `)
  return result.rows.map((row) => row.table_name)
}

async function readTableShapes(
  client: PoolClient,
  tableNames: readonly string[]
): Promise<Map<string, TableShape>> {
  const result = await client.query<{
    table_name: string
    column_name: string
    udt_name: string
    is_nullable: 'YES' | 'NO'
    is_generated: 'ALWAYS' | 'NEVER'
    column_default: string | null
    primary_key_ordinal: number | null
  }>(
    `
    select
      column_info.table_name,
      column_info.column_name,
      column_info.udt_name,
      column_info.is_nullable,
      column_info.is_generated,
      column_info.column_default,
      key_info.ordinal_position as primary_key_ordinal
    from information_schema.columns column_info
    left join (
      select
        key_column.table_name,
        key_column.column_name,
        key_column.ordinal_position
      from information_schema.table_constraints constraint_info
      join information_schema.key_column_usage key_column
        on key_column.constraint_schema = constraint_info.constraint_schema
        and key_column.constraint_name = constraint_info.constraint_name
      where constraint_info.table_schema = 'public'
        and constraint_info.constraint_type = 'PRIMARY KEY'
    ) key_info
      on key_info.table_name = column_info.table_name
      and key_info.column_name = column_info.column_name
    where column_info.table_schema = 'public'
      and column_info.table_name = any($1::text[])
    order by column_info.table_name, column_info.ordinal_position
  `,
    [tableNames]
  )

  const shapes = new Map<string, TableShape>()
  for (const tableName of tableNames) {
    const columns = result.rows.filter((row) => row.table_name === tableName)
    shapes.set(tableName, {
      columns: columns
        .filter((column) => column.is_generated === 'NEVER')
        .map((column) => ({
          name: column.column_name,
          type: column.udt_name,
          nullable: column.is_nullable === 'YES',
          hasDefault: column.column_default !== null
        })),
      primaryKey: columns
        .filter((column) => column.primary_key_ordinal !== null)
        .sort((left, right) => (left.primary_key_ordinal ?? 0) - (right.primary_key_ordinal ?? 0))
        .map((column) => column.column_name)
    })
  }

  return shapes
}

async function readForeignKeyEdges(client: PoolClient): Promise<ForeignKeyEdge[]> {
  const result = await client.query<ForeignKeyEdge>(`
    select
      referencing.relname as referencing_table,
      referenced.relname as referenced_table
    from pg_constraint constraint_info
    join pg_class referencing on referencing.oid = constraint_info.conrelid
    join pg_namespace referencing_namespace on referencing_namespace.oid = referencing.relnamespace
    join pg_class referenced on referenced.oid = constraint_info.confrelid
    join pg_namespace referenced_namespace on referenced_namespace.oid = referenced.relnamespace
    where constraint_info.contype = 'f'
      and referencing_namespace.nspname = 'public'
      and referenced_namespace.nspname = 'public'
  `)
  return result.rows
}

async function readImmediateUniqueTables(client: PoolClient): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(`
    select distinct relation.relname as table_name
    from pg_index index_info
    join pg_class relation on relation.oid = index_info.indrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    left join pg_constraint constraint_info on constraint_info.conindid = index_info.indexrelid
    where namespace.nspname = 'public'
      and index_info.indisunique
      and not index_info.indisprimary
      and (constraint_info.oid is null or not constraint_info.condeferrable)
      and exists (
        select 1
        from unnest(index_info.indkey) as index_column(attribute_number)
        join pg_attribute attribute
          on attribute.attrelid = relation.oid
          and attribute.attnum = index_column.attribute_number
        where attribute.attname = 'sort_order'
      )
    order by relation.relname
  `)
  return result.rows.map((row) => row.table_name)
}

async function readSequenceColumns(client: PoolClient): Promise<SequenceColumn[]> {
  const result = await client.query<SequenceColumn>(`
    select
      table_info.relname as table_name,
      attribute_info.attname as column_name,
      sequence_namespace.nspname || '.' || sequence_info.relname as sequence_name
    from pg_class sequence_info
    join pg_namespace sequence_namespace on sequence_namespace.oid = sequence_info.relnamespace
    join pg_depend dependency
      on dependency.objid = sequence_info.oid
      and dependency.classid = 'pg_class'::regclass
      and dependency.refclassid = 'pg_class'::regclass
      and dependency.deptype in ('a', 'i')
    join pg_class table_info on table_info.oid = dependency.refobjid
    join pg_namespace table_namespace on table_namespace.oid = table_info.relnamespace
    join pg_attribute attribute_info
      on attribute_info.attrelid = table_info.oid
      and attribute_info.attnum = dependency.refobjsubid
    where sequence_info.relkind = 'S'
      and sequence_namespace.nspname = 'public'
      and table_namespace.nspname = 'public'
  `)
  return result.rows
}

async function readSystemOwner(client: PoolClient): Promise<string> {
  const result = await client.query<{ user_id: string | null }>(`
    select user_id::text
    from public.systems
    where ruleset_code = 'dnd5e'
      and ruleset_version = '2014'
    limit 1
  `)
  const ownerId = result.rows[0]?.user_id
  if (!ownerId)
    throw new Error('The SRD system and its seed owner must exist before bulk synchronization.')
  return ownerId
}

async function countOwnedRoots(client: PoolClient): Promise<number> {
  const selects = ROOT_TABLES.map(
    (tableName) => `(select count(*) from ${tableRef(tableName)} where not is_master)`
  )
  const result = await client.query<{ count: string }>(`
    select (${selects.join(' + ')})::text as count
  `)
  return Number(result.rows[0]?.count ?? 0)
}

async function countRowsInTables(
  client: PoolClient,
  tableNames: readonly string[]
): Promise<number> {
  if (tableNames.length === 0) return 0
  const selects = tableNames.map((tableName) => `(select count(*) from ${tableRef(tableName)})`)
  const result = await client.query<{ count: string }>(`
    select (${selects.join(' + ')})::text as count
  `)
  return Number(result.rows[0]?.count ?? 0)
}

async function assertMasterOnlySource(client: PoolClient): Promise<void> {
  const tableResult = await client.query<{ table_name: string }>(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and (table_name = 'characters' or left(table_name, 10) = 'character_')
  `)
  const characterRows = await countRowsInTables(
    client,
    tableResult.rows.map((row) => row.table_name)
  )
  const ownedRoots = await countOwnedRoots(client)
  const definitionResult = await client.query<{ count: string }>(`
    select count(*)::text as count
    from public.authored_definitions
    where not is_master
  `)
  const ownedDefinitions = Number(definitionResult.rows[0]?.count ?? 0)

  if (characterRows > 0 || ownedRoots > 0 || ownedDefinitions > 0) {
    throw new Error(
      `Local source contains user-authored or character data; refusing the master-corpus sync ` +
        `(character rows: ${characterRows}, owned roots: ${ownedRoots}, owned definitions: ${ownedDefinitions}).`
    )
  }
}

async function loadSnapshots(
  client: PoolClient,
  orderedTables: readonly string[],
  shapes: ReadonlyMap<string, TableShape>,
  sourceOwnerId: string,
  targetOwnerId: string
): Promise<TableSnapshot[]> {
  const snapshots: TableSnapshot[] = []
  for (const tableName of orderedTables) {
    const shape = shapes.get(tableName)
    if (!shape || shape.primaryKey.length === 0) {
      throw new Error(`Master corpus table "${tableName}" must have a primary key.`)
    }

    const result = await client.query<{ row: Record<string, unknown> }>(`
      select to_jsonb(source_row) as row
      from ${tableRef(tableName)} source_row
    `)
    snapshots.push({
      name: tableName,
      columns: shape.columns,
      primaryKey: shape.primaryKey,
      rows: result.rows.map(({ row }) => remapOwner(row, sourceOwnerId, targetOwnerId))
    })
  }
  return snapshots
}

async function loadAuthoredDefinitions(
  client: PoolClient,
  sourceOwnerId: string,
  targetOwnerId: string
): Promise<AuthoredDefinitionSnapshot[]> {
  const result = await client.query<{
    subject_id: string
    subject_kind: string
    system_id: string
    label: string
    payload: Record<string, unknown>
  }>(`
    select
      definition.subject_id::text,
      definition.subject_kind,
      definition.system_id::text,
      definition.label,
      revision.payload
    from public.authored_definitions definition
    join public.authored_definition_revisions revision
      on revision.definition_id = definition.subject_id
      and revision.id = definition.active_revision_id
    where definition.is_master
    order by definition.subject_kind, definition.subject_id
  `)

  return result.rows.map((row) =>
    remapOwner(
      {
        subjectId: row.subject_id,
        subjectKind: row.subject_kind,
        systemId: row.system_id,
        label: row.label,
        payload: row.payload
      },
      sourceOwnerId,
      targetOwnerId
    )
  )
}

async function synchronizeAuthoredDefinitions(
  client: PoolClient,
  definitions: readonly AuthoredDefinitionSnapshot[]
): Promise<void> {
  if (definitions.length === 0) return
  const serializedDefinitions = JSON.stringify(definitions)

  const conflictResult = await client.query<{ subject_id: string }>(
    `
    with input as (
      select *
      from jsonb_to_recordset($1::jsonb) as record(
        "subjectId" uuid,
        "subjectKind" text,
        "systemId" uuid,
        label text,
        payload jsonb
      )
    )
    select definition.subject_id::text
    from public.authored_definitions definition
    join input on input."subjectId" = definition.subject_id
    where not definition.is_master
      or definition.subject_kind <> input."subjectKind"
    limit 1
    for update of definition
  `,
    [serializedDefinitions]
  )
  const conflictingSubjectId = conflictResult.rows[0]?.subject_id
  if (conflictingSubjectId) {
    throw new Error(
      `Master authored definition "${conflictingSubjectId}" conflicts with owned content.`
    )
  }

  await client.query(
    `
    with input as (
      select *
      from jsonb_to_recordset($1::jsonb) as record(
        "subjectId" uuid,
        "subjectKind" text,
        "systemId" uuid,
        label text,
        payload jsonb
      )
    )
    insert into public.authored_definitions (
      subject_id,
      subject_kind,
      owner_user_id,
      system_id,
      label,
      is_master,
      next_revision_number
    )
    select
      input."subjectId",
      input."subjectKind",
      null,
      input."systemId",
      input.label,
      true,
      1
    from input
    on conflict (subject_id) do nothing
  `,
    [serializedDefinitions]
  )

  await client.query(
    `
    with input as (
      select *
      from jsonb_to_recordset($1::jsonb) as record(
        "subjectId" uuid,
        "subjectKind" text,
        "systemId" uuid,
        label text,
        payload jsonb
      )
    ),
    revision_candidates as (
      select
        definition.subject_id,
        definition.active_revision_id,
        definition.next_revision_number,
        input.payload
      from input
      join public.authored_definitions definition
        on definition.subject_id = input."subjectId"
      left join public.authored_definition_revisions active_revision
        on active_revision.definition_id = definition.subject_id
        and active_revision.id = definition.active_revision_id
      where active_revision.payload is distinct from input.payload
    ),
    inserted_revisions as (
      insert into public.authored_definition_revisions (
        definition_id,
        revision_number,
        payload,
        base_active_revision_id,
        created_by_user_id
      )
      select
        candidate.subject_id,
        candidate.next_revision_number,
        candidate.payload,
        candidate.active_revision_id,
        null
      from revision_candidates candidate
      returning id, definition_id, revision_number
    )
    update public.authored_definitions definition
    set
      system_id = input."systemId",
      label = input.label,
      active_revision_id = coalesce(inserted_revision.id, definition.active_revision_id),
      next_revision_number = coalesce(
        inserted_revision.revision_number + 1,
        definition.next_revision_number
      ),
      updated_at = now()
    from input
    left join inserted_revisions inserted_revision
      on inserted_revision.definition_id = input."subjectId"
    where definition.subject_id = input."subjectId"
  `,
    [serializedDefinitions]
  )
}

function assertMatchingShapes(
  sourceShapes: ReadonlyMap<string, TableShape>,
  targetShapes: ReadonlyMap<string, TableShape>,
  tableNames: readonly string[]
): void {
  const incompatibilities: string[] = []

  for (const tableName of tableNames) {
    const source = sourceShapes.get(tableName)
    const target = targetShapes.get(tableName)
    if (!source || !target) {
      incompatibilities.push(`${tableName}: table is missing locally or on the target`)
      continue
    }

    const targetColumns = new Map(target.columns.map((column) => [column.name, column]))
    const missingOrDifferent = source.columns.filter((sourceColumn) => {
      const targetColumn = targetColumns.get(sourceColumn.name)
      if (!targetColumn) return true
      if (targetColumn.type === sourceColumn.type) return false

      const safeWidenings: Readonly<Record<string, readonly string[]>> = {
        int2: ['int4', 'int8', 'numeric'],
        int4: ['int8', 'numeric'],
        int8: ['numeric']
      }
      return !safeWidenings[sourceColumn.type]?.includes(targetColumn.type)
    })
    const requiredTargetOnly = target.columns.filter(
      (targetColumn) =>
        !source.columns.some((sourceColumn) => sourceColumn.name === targetColumn.name) &&
        !targetColumn.nullable &&
        !targetColumn.hasDefault
    )
    const primaryKeysMatch = JSON.stringify(source.primaryKey) === JSON.stringify(target.primaryKey)

    if (missingOrDifferent.length > 0 || requiredTargetOnly.length > 0 || !primaryKeysMatch) {
      incompatibilities.push(
        `${tableName}: missing or incompatible source columns ` +
          `[${missingOrDifferent.map(({ name }) => name).join(', ')}], required target-only columns ` +
          `[${requiredTargetOnly.map(({ name }) => name).join(', ')}], primary key differs: ${!primaryKeysMatch}`
      )
    }
  }

  if (incompatibilities.length > 0) {
    throw new Error(
      `Local and target schemas are incompatible:\n- ${incompatibilities.join('\n- ')}`
    )
  }
}

async function deleteExistingSnapshotRows(
  client: QueryClient,
  snapshot: TableSnapshot
): Promise<void> {
  const primaryKeyColumns = snapshot.primaryKey.map(quoteIdentifier)
  const selectedPrimaryKey = primaryKeyColumns.map((column) => `input.${column}`).join(', ')
  const primaryKeyMatch = primaryKeyColumns
    .map((column) => `target_row.${column} = input.${column}`)
    .join(' and ')

  for (let offset = 0; offset < snapshot.rows.length; offset += INSERT_BATCH_SIZE) {
    const rows = snapshot.rows.slice(offset, offset + INSERT_BATCH_SIZE)
    await client.query(
      `
      delete from ${tableRef(snapshot.name)} target_row
      using (
        select ${selectedPrimaryKey}
        from jsonb_populate_recordset(null::${tableRef(snapshot.name)}, $1::jsonb) input
      ) input
      where ${primaryKeyMatch}
    `,
      [JSON.stringify(rows)]
    )
  }
}

async function insertSnapshot(
  client: QueryClient,
  snapshot: TableSnapshot,
  upsertExisting: boolean
): Promise<void> {
  if (snapshot.rows.length === 0) return

  const columnNames = snapshot.columns.map(({ name }) => name)
  const columnList = columnNames.map(quoteIdentifier).join(', ')
  const selectedColumns = snapshot.columns
    .map(({ name }) => `input.${quoteIdentifier(name)}`)
    .join(', ')
  const primaryKey = new Set(snapshot.primaryKey)
  const updateColumns = columnNames.filter((column) => !primaryKey.has(column))
  const conflictAction =
    updateColumns.length === 0
      ? 'do nothing'
      : `do update set ${updateColumns
          .map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`)
          .join(', ')}`
  const conflictClause = upsertExisting
    ? `on conflict (${snapshot.primaryKey.map(quoteIdentifier).join(', ')}) ${conflictAction}`
    : ''
  for (let offset = 0; offset < snapshot.rows.length; offset += INSERT_BATCH_SIZE) {
    const rows = snapshot.rows.slice(offset, offset + INSERT_BATCH_SIZE)
    await client.query(
      `
      insert into ${tableRef(snapshot.name)} (${columnList})
      select ${selectedColumns}
      from jsonb_populate_recordset(null::${tableRef(snapshot.name)}, $1::jsonb) input
      ${conflictClause}
    `,
      [JSON.stringify(rows)]
    )
  }
}

export async function synchronizeSnapshot(
  client: QueryClient,
  snapshot: TableSnapshot,
  replaceExisting: boolean
): Promise<void> {
  if (snapshot.rows.length === 0) return
  if (replaceExisting) await deleteExistingSnapshotRows(client, snapshot)
  await insertSnapshot(client, snapshot, !replaceExisting)
}

async function synchronizeSequences(
  client: PoolClient,
  states: readonly SequenceState[]
): Promise<void> {
  for (const state of states) {
    await client.query(`select setval($1::regclass, $2::bigint, $3::boolean)`, [
      state.sequence_name,
      state.maximum_value,
      state.has_rows
    ])
  }
}

async function readSequenceStates(
  client: PoolClient,
  sequenceColumns: readonly SequenceColumn[],
  includedTables: ReadonlySet<string>
): Promise<SequenceState[]> {
  const states: SequenceState[] = []
  for (const sequence of sequenceColumns) {
    if (!includedTables.has(sequence.table_name)) continue
    const result = await client.query<{
      maximum_value: string
      has_rows: boolean
    }>(
      `
      select
        coalesce(max(${quoteIdentifier(sequence.column_name)})::bigint, 1)::text as maximum_value,
        exists(select 1 from ${tableRef(sequence.table_name)}) as has_rows
      from ${tableRef(sequence.table_name)}
    `
    )
    const state = result.rows[0]
    if (!state) throw new Error(`Failed to read sequence state for ${sequence.sequence_name}.`)
    states.push({ ...sequence, ...state })
  }
  return states
}

async function assertSnapshotsMatch(
  client: PoolClient,
  snapshots: readonly TableSnapshot[]
): Promise<void> {
  for (const snapshot of snapshots) {
    const comparableColumns = snapshot.columns.filter(
      ({ name }) => name !== 'created_at' && name !== 'updated_at'
    )
    const primaryKeyMatch = snapshot.primaryKey
      .map(
        (column) =>
          `target_row.${quoteIdentifier(column)} is not distinct from input.${quoteIdentifier(column)}`
      )
      .join(' and ')
    const valueMatch = comparableColumns
      .map(
        ({ name }) =>
          `target_row.${quoteIdentifier(name)} is not distinct from input.${quoteIdentifier(name)}`
      )
      .join(' and ')

    for (let offset = 0; offset < snapshot.rows.length; offset += INSERT_BATCH_SIZE) {
      const rows = snapshot.rows.slice(offset, offset + INSERT_BATCH_SIZE)
      const result = await client.query<{ source_row: Record<string, unknown> }>(
        `
        select to_jsonb(input) as source_row
        from jsonb_populate_recordset(null::${tableRef(snapshot.name)}, $1::jsonb) input
        where not exists (
          select 1
          from ${tableRef(snapshot.name)} target_row
          where ${primaryKeyMatch}
            and ${valueMatch}
        )
        limit 1
      `,
        [JSON.stringify(rows)]
      )
      const mismatch = result.rows[0]?.source_row
      if (mismatch) {
        const primaryKey = Object.fromEntries(
          snapshot.primaryKey.map((column) => [column, mismatch[column]])
        )
        throw new Error(
          `Target parity mismatch after synchronization in ${snapshot.name} at ` +
            `${JSON.stringify(primaryKey)}.`
        )
      }
    }
  }
}

async function assertAuthoredDefinitionsMatch(
  client: PoolClient,
  definitions: readonly AuthoredDefinitionSnapshot[]
): Promise<void> {
  if (definitions.length === 0) return
  const result = await client.query<{ subject_id: string }>(
    `
    with input as (
      select *
      from jsonb_to_recordset($1::jsonb) as record(
        "subjectId" uuid,
        "subjectKind" text,
        "systemId" uuid,
        label text,
        payload jsonb
      )
    )
    select input."subjectId"::text as subject_id
    from input
    left join public.authored_definitions definition
      on definition.subject_id = input."subjectId"
    left join public.authored_definition_revisions revision
      on revision.definition_id = definition.subject_id
      and revision.id = definition.active_revision_id
    where definition.subject_id is null
      or not definition.is_master
      or definition.owner_user_id is not null
      or definition.subject_kind is distinct from input."subjectKind"
      or definition.system_id is distinct from input."systemId"
      or definition.label is distinct from input.label
      or revision.payload is distinct from input.payload
    limit 1
  `,
    [JSON.stringify(definitions)]
  )
  const mismatch = result.rows[0]?.subject_id
  if (mismatch) {
    throw new Error(`Target authored-definition parity mismatch for ${mismatch}.`)
  }
}

async function applyCorpusSync(
  target: PoolClient,
  snapshots: readonly TableSnapshot[],
  authoredDefinitions: readonly AuthoredDefinitionSnapshot[],
  replaceExistingTables: ReadonlySet<string>
): Promise<void> {
  for (const snapshot of snapshots) {
    await synchronizeSnapshot(target, snapshot, replaceExistingTables.has(snapshot.name))
    if (snapshot.rows.length > 0) {
      console.info(`Seeded ${snapshot.name}: ${snapshot.rows.length} rows`)
    }
  }

  // Updating legacy owner rows can fire cleanup triggers which remove an owned row that the
  // canonical corpus reuses. Once every owner points at its canonical child, a plain upsert pass
  // restores any such source rows without retriggering cleanup for changed references.
  for (const snapshot of snapshots) {
    await synchronizeSnapshot(target, snapshot, false)
  }

  await synchronizeAuthoredDefinitions(target, authoredDefinitions)
  console.info(`Seeded authored projections: ${authoredDefinitions.length}`)

  await target.query('set constraints all immediate')
  await assertSnapshotsMatch(target, snapshots)
  await assertAuthoredDefinitionsMatch(target, authoredDefinitions)
}

async function main() {
  const localOnly = process.argv.includes(LOCAL_FLAG)
  const dryRun = process.argv.includes(DRY_RUN_FLAG)

  if (localOnly) {
    if (dryRun) {
      throw new Error(`${LOCAL_FLAG} and ${DRY_RUN_FLAG} cannot be used together.`)
    }

    await seedLocalSrdCorpus(readLocalSourceDatabaseUrl())
    return
  }

  const targetDatabaseUrl = process.env.PROD_DATABASE_CONNECTION_STRING
  if (!targetDatabaseUrl) {
    throw new Error('PROD_DATABASE_CONNECTION_STRING is required for the bulk SRD seed target.')
  }
  if (!dryRun && !process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(`Bulk SRD synchronization requires the explicit ${CONFIRM_FLAG} flag.`)
  }
  if (
    !dryRun &&
    isLocalDatabaseUrl(targetDatabaseUrl) &&
    !process.argv.includes(ALLOW_LOCAL_TARGET_FLAG)
  ) {
    throw new Error(`A local bulk target requires the explicit ${ALLOW_LOCAL_TARGET_FLAG} flag.`)
  }

  const sourceDatabaseUrl = readProductionSourceDatabaseUrl()

  if (!dryRun) {
    await seedLocalSrdCorpus(sourceDatabaseUrl)
  }

  console.info('Auditing the local SRD materialization...')
  const sourceAuditDb = createDb({ connectionString: sourceDatabaseUrl })
  try {
    const audit = await auditSrdData(sourceAuditDb)
    if (hasSrdAuditIssues(audit)) {
      throw new Error(
        'The local SRD materialization failed its parity audit; refusing to upload it.'
      )
    }
  } finally {
    await sourceAuditDb.destroy()
  }

  const sourcePool = new Pool({ connectionString: sourceDatabaseUrl, max: 2 })
  const targetPool = new Pool({ connectionString: targetDatabaseUrl, max: 2 })
  const source = await sourcePool.connect()
  const target = await targetPool.connect()

  try {
    console.info('Validating the source corpus and target schema...')
    await assertMasterOnlySource(source)

    const [sourceOwnerId, targetOwnerId, sourceTableNames] = await Promise.all([
      readSystemOwner(source),
      readSystemOwner(target),
      listCorpusTableNames(source)
    ])
    const targetTableNames = await listCorpusTableNames(target)
    const missingFromTarget = sourceTableNames.filter(
      (tableName) => !targetTableNames.includes(tableName)
    )
    if (missingFromTarget.length > 0) {
      throw new Error(
        `Target database is missing master corpus tables: ${missingFromTarget.join(', ')}.`
      )
    }
    const targetOnly = targetTableNames.filter((tableName) => !sourceTableNames.includes(tableName))
    if (targetOnly.length > 0) {
      console.info(`Preserving target-only legacy tables: ${targetOnly.join(', ')}`)
    }

    const [sourceMetadata, targetMetadata] = await Promise.all([
      (async () => ({
        shapes: await readTableShapes(source, sourceTableNames),
        foreignKeys: await readForeignKeyEdges(source)
      }))(),
      (async () => ({
        shapes: await readTableShapes(target, sourceTableNames),
        foreignKeys: await readForeignKeyEdges(target),
        immediateUniqueTables: await readImmediateUniqueTables(target),
        sequenceColumns: await readSequenceColumns(target)
      }))()
    ])
    const sourceShapes = sourceMetadata.shapes
    const targetShapes = targetMetadata.shapes
    const foreignKeys = sourceMetadata.foreignKeys
    const targetForeignKeys = targetMetadata.foreignKeys
    const immediateUniqueTables = targetMetadata.immediateUniqueTables
    const sequenceColumns = targetMetadata.sequenceColumns
    assertMatchingShapes(sourceShapes, targetShapes, sourceTableNames)
    const orderedTables = orderTables(
      sourceTableNames.filter((tableName) => !AUTHORED_TABLES.has(tableName)),
      foreignKeys
    )
    const referencedTargetTables = new Set(
      targetForeignKeys.map((foreignKey) => foreignKey.referenced_table)
    )
    const immediateUniqueTableSet = new Set(immediateUniqueTables)
    const unsafeReplacementTables = orderedTables.filter(
      (tableName) => immediateUniqueTableSet.has(tableName) && referencedTargetTables.has(tableName)
    )
    if (unsafeReplacementTables.length > 0) {
      throw new Error(
        `Cannot safely replace rows with immediate alternate uniqueness because other tables ` +
          `reference them: ${unsafeReplacementTables.join(', ')}.`
      )
    }
    const replaceExistingTables = new Set(
      orderedTables.filter((tableName) => immediateUniqueTableSet.has(tableName))
    )

    console.info('Loading the validated local corpus into memory...')
    const [snapshots, authoredDefinitions] = await Promise.all([
      loadSnapshots(source, orderedTables, sourceShapes, sourceOwnerId, targetOwnerId),
      loadAuthoredDefinitions(source, sourceOwnerId, targetOwnerId)
    ])
    const totalRows = snapshots.reduce((total, snapshot) => total + snapshot.rows.length, 0)
    const includedTables = new Set(orderedTables)
    console.info(
      `Loaded ${totalRows} relational rows across ${snapshots.length} tables and ` +
        `${authoredDefinitions.length} authored projections.`
    )

    if (dryRun) {
      console.info(
        `Bulk SRD dry run complete: ${totalRows} relational rows and ` +
          `${authoredDefinitions.length} authored projections are ready to synchronize; no database was modified.`
      )
      return
    }

    console.info('Synchronizing the target master corpus in one transaction...')
    await target.query('begin')
    try {
      await target.query('set constraints all deferred')
      await applyCorpusSync(target, snapshots, authoredDefinitions, replaceExistingTables)
      const sequenceStates = await readSequenceStates(target, sequenceColumns, includedTables)

      await synchronizeSequences(target, sequenceStates)
      await target.query('commit')
    } catch (error) {
      await target.query('rollback')
      throw error
    }

    console.info(
      `Bulk SRD master corpus synchronization complete: ${totalRows} relational rows and ` +
        `${authoredDefinitions.length} authored projections.`
    )
    console.info('Run the production SRD audit to verify target hydration and source parity.')
  } finally {
    source.release()
    target.release()
    await Promise.all([sourcePool.end(), targetPool.end()])
  }
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
