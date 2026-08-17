import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Transaction } from 'kysely'

import { createDb } from '../client.js'
import { pruneStaleBaselineContent, seedBaselineContent } from '../seed/baseline.js'
import { assignBaselineContentOwner } from '../source-data/content.js'
import { SRD_SYSTEM_ID, srdBaselineContent } from '../source-data/srd/index.js'
import type { Database } from '../types/index.js'
import { auditSrdData, hasSrdAuditIssues } from './auditSrdData.js'
import {
  ensureSeedOwnerUser,
  findSeedOwnerUserByEmail,
  readSeedOwnerEnvironment,
  type SeedOwnerEnvironment,
  type SeedTarget
} from './seedOwner.js'
import {
  applyCorpusSync,
  assertMatchingShapes,
  corpusTableNames,
  createQueryClient,
  listPublicTableNames,
  loadSnapshots,
  orderTables,
  readForeignKeyEdges,
  readTableShapes,
  truncatePublicTables,
  type TableSnapshot
} from './srdBatchSync.js'

const CONFIRM_FLAG = '--confirm-seed-srd'
const DRY_RUN_FLAG = '--dry-run'
const TARGET_FLAGS = {
  local: '--local',
  staging: '--staging',
  production: '--production'
} as const satisfies Record<SeedTarget, string>
const ROLLBACK_DRY_RUN = new Error('ROLLBACK_SRD_DRY_RUN')
const ROLLBACK_LOCAL_MATERIALIZATION = new Error('ROLLBACK_LOCAL_SRD_MATERIALIZATION')

export interface SeedInvocation {
  dryRun: boolean
  target: SeedTarget
}

export function parseSeedInvocation(args: readonly string[]): SeedInvocation {
  const targets = (Object.entries(TARGET_FLAGS) as [SeedTarget, string][]).filter(([, flag]) =>
    args.includes(flag)
  )
  if (targets.length !== 1) {
    throw new Error(`Pass exactly one of ${Object.values(TARGET_FLAGS).join(', ')}.`)
  }

  const target = targets[0]?.[0]
  if (!target) throw new Error('Missing SRD seed target.')
  const dryRun = args.includes(DRY_RUN_FLAG)
  if (target === 'local' && dryRun) {
    throw new Error(`${TARGET_FLAGS.local} and ${DRY_RUN_FLAG} cannot be used together.`)
  }
  if (target !== 'local' && !dryRun && !args.includes(CONFIRM_FLAG)) {
    throw new Error(`Hosted SRD seeding requires the explicit ${CONFIRM_FLAG} flag.`)
  }

  return { dryRun, target }
}

export function assertDatabaseTarget(target: SeedTarget, connectionString: string) {
  const hostname = new URL(connectionString).hostname.toLowerCase()
  const local = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
  if (target === 'local' && !local) {
    throw new Error('The local SRD seed command requires a local database connection.')
  }
  if (target !== 'local' && local) {
    throw new Error(`The ${target} SRD seed command requires a hosted database connection.`)
  }
}

async function resolveSeedOwner(environment: SeedOwnerEnvironment, dryRun: boolean) {
  if (!dryRun) return ensureSeedOwnerUser(environment)

  const existing = await findSeedOwnerUserByEmail(environment)
  if (!existing) {
    throw new Error(
      `The ${environment.email} seed owner must exist before a dry run. ` +
        'Run the matching seed-owner command first.'
    )
  }
  return existing
}

async function seedAndAudit(
  transaction: Transaction<Database>,
  ownerUserId: string
): Promise<{ domainRoots: number; systems: number }> {
  const result = await seedBaselineContent(
    { db: transaction, systemId: SRD_SYSTEM_ID },
    assignBaselineContentOwner(srdBaselineContent, ownerUserId)
  )
  const audit = await auditSrdData(transaction)
  if (hasSrdAuditIssues(audit)) {
    throw new Error(`SRD parity audit failed:\n${JSON.stringify(audit, null, 2)}`)
  }
  return result
}

interface MaterializedCorpus {
  sourceShapes: Awaited<ReturnType<typeof readTableShapes>>
  snapshots: TableSnapshot[]
}

async function materializeCorpus(
  sourceOwnerId: string,
  targetOwnerId: string
): Promise<MaterializedCorpus> {
  const localEnvironment = readSeedOwnerEnvironment('local')
  assertDatabaseTarget('local', localEnvironment.connectionString)
  const localDb = createDb({ connectionString: localEnvironment.connectionString })
  let materialized: MaterializedCorpus | undefined

  try {
    console.info('Materializing the repository SRD corpus in a rollback-only local transaction...')
    try {
      await localDb.transaction().execute(async (transaction) => {
        const client = createQueryClient(transaction)
        const publicTables = await listPublicTableNames(client)

        // Build a pristine relational corpus from repository source without preserving a second
        // local database. PostgreSQL rolls the truncate and every normalized seed write back.
        await truncatePublicTables(client, publicTables)
        await seedAndAudit(transaction, sourceOwnerId)

        const tableNames = corpusTableNames(publicTables)
        const sourceShapes = await readTableShapes(client, tableNames)
        const orderedTables = orderTables(tableNames, await readForeignKeyEdges(client))
        materialized = {
          sourceShapes,
          snapshots: await loadSnapshots(
            client,
            orderedTables,
            sourceShapes,
            sourceOwnerId,
            targetOwnerId
          )
        }
        throw ROLLBACK_LOCAL_MATERIALIZATION
      })
    } catch (error) {
      if (error !== ROLLBACK_LOCAL_MATERIALIZATION) throw error
    }
  } finally {
    await localDb.destroy()
  }

  if (!materialized) throw new Error('Failed to materialize the local SRD corpus.')
  return materialized
}

async function seedHostedTarget(
  invocation: SeedInvocation,
  targetOwnerId: string,
  targetConnectionString: string
): Promise<{ relationalRows: number; tables: number }> {
  const localEnvironment = readSeedOwnerEnvironment('local')
  const localOwner = await ensureSeedOwnerUser(localEnvironment)
  const materialized = await materializeCorpus(localOwner.id, targetOwnerId)
  const targetDb = createDb({ connectionString: targetConnectionString })
  const result = {
    relationalRows: materialized.snapshots.reduce(
      (total, snapshot) => total + snapshot.rows.length,
      0
    ),
    tables: materialized.snapshots.length
  }
  console.info(
    `Materialized ${result.relationalRows} relational rows across ${result.tables} tables.`
  )

  try {
    console.info('Validating the target schema and synchronizing FK-ordered 500-row batches...')
    try {
      await targetDb.transaction().execute(async (transaction) => {
        const client = createQueryClient(transaction)
        const targetTables = new Set(await listPublicTableNames(client))
        const missingTables = materialized.snapshots
          .map(({ name }) => name)
          .filter((tableName) => !targetTables.has(tableName))
        if (missingTables.length > 0) {
          throw new Error(`Target database is missing corpus tables: ${missingTables.join(', ')}.`)
        }

        const snapshotTableNames = materialized.snapshots.map(({ name }) => name)
        assertMatchingShapes(
          materialized.sourceShapes,
          await readTableShapes(client, snapshotTableNames),
          snapshotTableNames
        )

        await client.query('set constraints all deferred')
        await pruneStaleBaselineContent(
          { db: transaction, systemId: SRD_SYSTEM_ID },
          assignBaselineContentOwner(srdBaselineContent, targetOwnerId)
        )
        await applyCorpusSync(client, materialized.snapshots, await readForeignKeyEdges(client))
        if (invocation.dryRun) throw ROLLBACK_DRY_RUN
      })
    } catch (error) {
      if (error !== ROLLBACK_DRY_RUN) throw error
    }
  } finally {
    await targetDb.destroy()
  }

  return result
}

async function main() {
  const invocation = parseSeedInvocation(process.argv.slice(2))
  const environment = readSeedOwnerEnvironment(invocation.target)
  assertDatabaseTarget(invocation.target, environment.connectionString)
  const owner = await resolveSeedOwner(environment, invocation.dryRun)
  let result: Record<string, number>

  if (invocation.target === 'local') {
    const db = createDb({ connectionString: environment.connectionString })
    try {
      result = await db.transaction().execute((transaction) => seedAndAudit(transaction, owner.id))
    } finally {
      await db.destroy()
    }
  } else {
    result = await seedHostedTarget(invocation, owner.id, environment.connectionString)
  }

  console.info(
    JSON.stringify({
      ...result,
      mode: invocation.dryRun ? 'DRY_RUN_ROLLED_BACK' : 'COMMITTED',
      target: invocation.target
    })
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
