import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

import {
  createAuthoredVersionRepository,
  createDb,
  type AuthoredVersionRecord,
  type DBLike
} from '@artificer-toolkit/db'
import type { AuthoredSubjectKind } from '@artificer-toolkit/schema/projections/identity'

import { assertAuthoredProjectionRebuild } from '../services/authoredContent/authoredProjectionRebuild.js'

type Target = 'local' | 'staging' | 'production'

const subjectKinds = [
  'BACKGROUND',
  'CLASS',
  'CREATURE',
  'EQUIPMENT',
  'FEAT',
  'RACE',
  'SPELL',
  'VEHICLE'
] as const satisfies readonly AuthoredSubjectKind[]

const connectionVariableByTarget = {
  local: 'DATABASE_CONNECTION_STRING',
  staging: 'STAGING_DATABASE_CONNECTION_STRING',
  production: 'PROD_DATABASE_CONNECTION_STRING'
} as const satisfies Record<Target, string>

function parseTarget(args: readonly string[]): Target {
  const targets = ['local', 'staging', 'production'].filter((target): target is Target =>
    args.includes(`--${target}`)
  )
  if (targets.length !== 1) {
    throw new Error('Pass exactly one of --local, --staging, or --production.')
  }
  return targets[0]
}

function requireConnectionString(target: Target): string {
  const name = connectionVariableByTarget[target]
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required to verify authored projections.`)
  return value
}

async function loadDependencies(
  db: DBLike,
  record: AuthoredVersionRecord
): Promise<AuthoredVersionRecord[]> {
  const records = await createAuthoredVersionRepository(db).findExactVersions({
    entries: record.compiled.authoredDependencies
  })
  return record.compiled.authoredDependencies.map((reference) => {
    const dependency = records.get(`${reference.subjectKind}:${reference.subjectId}`)
    if (!dependency) {
      throw new Error(
        `Authored ${record.authored.subjectKind} "${record.authored.subjectId}" has an unavailable or mismatched ${reference.subjectKind} dependency.`
      )
    }
    return dependency
  })
}

export async function verifyAuthoredProjections(db: DBLike): Promise<Record<AuthoredSubjectKind, number>> {
  const repository = createAuthoredVersionRepository(db)
  const counts = {} as Record<AuthoredSubjectKind, number>
  for (const subjectKind of subjectKinds) {
    const records = await repository.listVersions({ subjectKind })
    for (const record of records) {
      assertAuthoredProjectionRebuild(record, await loadDependencies(db, record))
    }
    counts[subjectKind] = records.length
  }
  return counts
}

async function main(): Promise<void> {
  const target = parseTarget(process.argv.slice(2))
  const db = createDb({ connectionString: requireConnectionString(target) })
  try {
    const counts = await verifyAuthoredProjections(db)
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
    console.info(`Verified ${total} immutable authored projections for ${target}.`)
    console.info(JSON.stringify(counts))
  } finally {
    await db.destroy()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main()
}
