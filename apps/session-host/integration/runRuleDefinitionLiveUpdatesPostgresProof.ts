import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

import { proveRuleDefinitionLiveUpdatesPostgresSemantics } from './ruleDefinitionLiveUpdatesPostgresProof.js'

function loadLocalEnvironment(): void {
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  const path = `${root}/.env.local`
  if (!existsSync(path)) throw new Error('Root .env.local is required for this local proof.')
  for (const [key, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function required(name: string): string {
  const value = process.env[name]
  if (!value)
    throw new Error(`${name} is required for the rule-definition live-update PostgreSQL proof.`)
  return value
}

loadLocalEnvironment()
await proveRuleDefinitionLiveUpdatesPostgresSemantics({
  connectionString: required('DATABASE_CONNECTION_STRING'),
  runId: randomUUID(),
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  supabaseUrl: required('SUPABASE_URL')
})
