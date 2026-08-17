import { createDb } from '@artificer-toolkit/db'

import { installDnd5e2014CanonicalRulePack } from '../services/rules/canonicalRulePackInstaller.js'

function connectionString(): string {
  const local = process.argv.includes('--local')
  const staging = process.argv.includes('--staging')
  const production = process.argv.includes('--production')
  if ([local, staging, production].filter(Boolean).length !== 1) {
    throw new Error('Pass exactly one of --local, --staging, or --production.')
  }
  const name = staging
    ? 'STAGING_DATABASE_CONNECTION_STRING'
    : production
      ? 'PROD_DATABASE_CONNECTION_STRING'
      : 'DATABASE_CONNECTION_STRING'
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required.`)
  return value
}

async function main(): Promise<void> {
  const db = createDb({ connectionString: connectionString() })
  try {
    console.info(JSON.stringify(await installDnd5e2014CanonicalRulePack(db)))
  } finally {
    await db.destroy()
  }
}

await main()
