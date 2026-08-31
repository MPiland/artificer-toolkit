import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import pg from 'pg'

const { Client } = pg

const CONFIRMATION_VALUE = 'reset-public-schema'
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const MIGRATIONS_ROOT = join(REPOSITORY_ROOT, 'supabase', 'migrations')

export type RemoteSchemaResetTarget = 'staging' | 'production'

const REMOTE_RESET_TARGETS = {
  staging: {
    connectionVariable: 'STAGING_DATABASE_CONNECTION_STRING',
    flag: '--staging'
  },
  production: {
    connectionVariable: 'PROD_DATABASE_CONNECTION_STRING',
    flag: '--production'
  }
} as const satisfies Record<RemoteSchemaResetTarget, { connectionVariable: string; flag: string }>

interface BootstrapStage {
  label: string
  sql: string
}

type DatabaseClient = InstanceType<typeof Client>

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

function describeDatabase(connectionString: string): string {
  const parsed = new URL(connectionString)
  const username = parsed.username ? `${parsed.username}@` : ''

  return `${parsed.protocol}//${username}${parsed.host}${parsed.pathname}`
}

export function assertRemoteDatabaseConnectionString(connectionString: string): void {
  const hostname = new URL(connectionString).hostname.toLowerCase()
  const localHostnames = new Set(['0.0.0.0', '127.0.0.1', '::1', '[::1]', 'localhost'])

  if (localHostnames.has(hostname) || hostname.startsWith('127.')) {
    throw new Error('A hosted public-schema reset must not point to a local database.')
  }
}

export function parseRemoteSchemaResetTarget(args: readonly string[]): RemoteSchemaResetTarget {
  const targets = (
    Object.entries(REMOTE_RESET_TARGETS) as [
      RemoteSchemaResetTarget,
      (typeof REMOTE_RESET_TARGETS)[RemoteSchemaResetTarget]
    ][]
  ).filter(([, configuration]) => args.includes(configuration.flag))

  if (targets.length !== 1) {
    throw new Error('Pass exactly one of --staging or --production.')
  }

  const target = targets[0]?.[0]
  if (!target) throw new Error('A hosted public-schema reset target is required.')
  return target
}

export async function readCanonicalMigrationStages(): Promise<BootstrapStage[]> {
  const migrationNames = (await readdir(MIGRATIONS_ROOT))
    .filter((name) => name.endsWith('.sql'))
    .sort()
  if (migrationNames.length === 0) {
    throw new Error('Canonical Supabase migrations are unavailable.')
  }

  return Promise.all(
    migrationNames.map(async (name) => {
      const sql = (await readFile(join(MIGRATIONS_ROOT, name), 'utf8')).trim()
      if (!sql) throw new Error(`Canonical migration ${name} is empty.`)
      return { label: `supabase/migrations/${name}`, sql }
    })
  )
}

async function executeDropStatements(client: DatabaseClient, query: string): Promise<void> {
  const result = await client.query<{ drop_sql: string }>(query)
  for (const row of result.rows) {
    await client.query(row.drop_sql)
  }
}

async function clearPublicSchema(client: DatabaseClient): Promise<void> {
  await executeDropStatements(
    client,
    `
      select case relation.relkind
        when 'v' then format('drop view if exists %I.%I cascade', namespace.nspname, relation.relname)
        when 'm' then format('drop materialized view if exists %I.%I cascade', namespace.nspname, relation.relname)
        when 'S' then format('drop sequence if exists %I.%I cascade', namespace.nspname, relation.relname)
        when 'f' then format('drop foreign table if exists %I.%I cascade', namespace.nspname, relation.relname)
        else format('drop table if exists %I.%I cascade', namespace.nspname, relation.relname)
      end as drop_sql
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
      order by case relation.relkind when 'v' then 0 when 'm' then 1 else 2 end, relation.relname
    `
  )
  await executeDropStatements(
    client,
    `
      select format(
        'drop %s if exists %I.%I(%s) cascade',
        case routine.prokind when 'p' then 'procedure' when 'a' then 'aggregate' else 'function' end,
        namespace.nspname,
        routine.proname,
        pg_get_function_identity_arguments(routine.oid)
      ) as drop_sql
      from pg_proc routine
      join pg_namespace namespace on namespace.oid = routine.pronamespace
      where namespace.nspname = 'public'
      order by routine.proname, routine.oid
    `
  )
  await executeDropStatements(
    client,
    `
      select format('drop type if exists %I.%I cascade', namespace.nspname, type_info.typname) as drop_sql
      from pg_type type_info
      join pg_namespace namespace on namespace.oid = type_info.typnamespace
      where namespace.nspname = 'public'
        and type_info.typisdefined
        and type_info.typelem = 0
        and type_info.typtype in ('b', 'c', 'd', 'e', 'm', 'r')
      order by type_info.typname
    `
  )

  await client.query('DROP SCHEMA IF EXISTS public CASCADE')
  await client.query('CREATE SCHEMA public')
  await client.query('ALTER SCHEMA public OWNER TO postgres')
  await client.query('GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role')
  await client.query('GRANT ALL ON SCHEMA public TO postgres, service_role')
}

async function rebuildPublicSchema(client: DatabaseClient): Promise<void> {
  await clearPublicSchema(client)
  await client.query('SET search_path = public, pg_catalog')

  const stages = await readCanonicalMigrationStages()
  console.log(`Applying the canonical schema in ${stages.length} lock-bounded stages.`)
  for (const stage of stages) {
    try {
      await client.query(stage.sql)
    } catch (error) {
      throw new Error(`Schema stage ${stage.label} failed.`, { cause: error })
    }
  }

  await client.query('GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role')
  await client.query(
    'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, service_role'
  )
  await client.query(
    'GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role'
  )
  await client.query(
    'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role'
  )
  await client.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role'
  )
  await client.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role'
  )
  await client.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role'
  )
}

async function main() {
  const target = parseRemoteSchemaResetTarget(process.argv.slice(2))
  const connectionString = requireEnv(REMOTE_RESET_TARGETS[target].connectionVariable)
  const confirmation = requireEnv('CONFIRM_REMOTE_PUBLIC_SCHEMA_RESET')

  assertRemoteDatabaseConnectionString(connectionString)

  if (confirmation !== CONFIRMATION_VALUE) {
    throw new Error(`CONFIRM_REMOTE_PUBLIC_SCHEMA_RESET must equal "${CONFIRMATION_VALUE}".`)
  }

  const client = new Client({ connectionString })

  console.log(`Resetting ${target} public schema on ${describeDatabase(connectionString)}.`)

  await client.connect()

  try {
    await client.query("SET statement_timeout = '10min'")
    await rebuildPublicSchema(client)
  } finally {
    await client.end()
  }

  console.log('Public schema reset complete.')
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
