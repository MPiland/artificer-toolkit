import { randomUUID } from 'node:crypto'

import { proveRuleExecutionOccurrencePostgresSemantics } from './ruleExecutionOccurrencePostgresProof.js'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the rule-occurrence PostgreSQL proof.`)
  return value
}

await proveRuleExecutionOccurrencePostgresSemantics({
  connectionString: required('DATABASE_CONNECTION_STRING'),
  runId: randomUUID(),
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  supabaseUrl: required('SUPABASE_URL')
})
