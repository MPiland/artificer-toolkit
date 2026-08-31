import { randomUUID } from 'node:crypto'

import { proveGate2EncounterRuleActionPostgresSemantics } from './gate2EncounterRuleActionPostgresProof.js'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the Gate 2 action PostgreSQL proof.`)
  return value
}

await proveGate2EncounterRuleActionPostgresSemantics({
  connectionString: required('DATABASE_CONNECTION_STRING'),
  runId: randomUUID(),
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  supabaseUrl: required('SUPABASE_URL')
})
