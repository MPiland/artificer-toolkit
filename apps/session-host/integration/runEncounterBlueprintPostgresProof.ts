import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  encounterBlueprintProofModes,
  proveEncounterBlueprintPostgresSemantics
} from './encounterBlueprintPostgresProof.js'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the Encounter Blueprint PostgreSQL proof.`)
  return value
}

const mode = process.argv[2]
if (!encounterBlueprintProofModes.includes(mode as (typeof encounterBlueprintProofModes)[number])) {
  throw new Error(`Use one of: ${encounterBlueprintProofModes.join(', ')}`)
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const statePath =
  process.env.GATE1_BLUEPRINT_STATE_PATH ??
  resolve(repositoryRoot, '.codex/validation/rules-runtime-rebaseline/gate1-blueprint-state.json')
if (mode !== 'prepare-extreme' && !existsSync(statePath)) {
  throw new Error(
    `Proof state is missing at ${statePath}. Run prepare-extreme, require migration failure, then verify-failed-cleanup-extreme first.`
  )
}
const runId =
  mode === 'prepare-extreme' && !existsSync(statePath)
    ? (process.env.GATE1_BLUEPRINT_RUN_ID ?? randomUUID())
    : (JSON.parse(readFileSync(statePath, 'utf8')) as { runId?: unknown }).runId
if (typeof runId !== 'string' || runId.length === 0) {
  throw new Error(`Proof state at ${statePath} has no valid runId.`)
}

await proveEncounterBlueprintPostgresSemantics({
  connectionString: required('DATABASE_CONNECTION_STRING'),
  mode: mode as (typeof encounterBlueprintProofModes)[number],
  runId,
  statePath,
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  supabaseUrl: required('SUPABASE_URL')
})
