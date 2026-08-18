import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

import {
  createCharacterMechanicsProjectionRepository,
  createDb,
  type DBLike
} from '@artificer-toolkit/db'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'

import { loadCharacterCommittedSheetSources } from '../services/character/characterCommittedSheetSources.js'

type Target = 'local' | 'staging' | 'production'

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
  if (!value) throw new Error(`${name} is required to verify Character mechanics projections.`)
  return value
}

export async function verifyCharacterMechanicsProjections(db: DBLike): Promise<number> {
  const characters = await db
    .selectFrom('characters')
    .select(['id', 'stream_version', 'rule_pack_revision_id'])
    .where('status', '=', AUTHORED_RECORD_STATUS.ACTIVE)
    .execute()
  const projections = createCharacterMechanicsProjectionRepository(db)

  for (const character of characters) {
    if (!character.rule_pack_revision_id) {
      throw new Error(`Active Character "${character.id}" has no pinned rule revision.`)
    }
    const mechanics = await projections.requireCurrent({
      characterId: character.id,
      expectedRuleRevisionId: character.rule_pack_revision_id,
      expectedStreamVersion: character.stream_version
    })
    await loadCharacterCommittedSheetSources({ db, mechanics })
  }

  return characters.length
}

async function main(): Promise<void> {
  const target = parseTarget(process.argv.slice(2))
  const db = createDb({ connectionString: requireConnectionString(target) })
  try {
    const count = await verifyCharacterMechanicsProjections(db)
    console.info(`Verified ${count} current Character mechanics projections for ${target}.`)
  } finally {
    await db.destroy()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main()
}
