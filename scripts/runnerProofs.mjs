// The proof list of scripts/runLocalConvexProof.ps1, read by the browser journey selection
// (scripts/affectedBrowserJourneys.mjs), the acceptance ledger and the local release lifecycle
// (scripts/validatePreStagingLocal.mjs). It imports nothing, so the lifecycle reading it does not put
// the journey selector or its known-bug labels on the path to a browser journey.

const PROOF_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Splits a proof name list and checks each name's shape. */
export function proofNames(text) {
  const names = text.split(/[\s,]+/).filter(Boolean)
  const invalid = names.find((name) => !PROOF_NAME.test(name))
  if (invalid) throw new Error(`${invalid} is not a proof name.`)
  return names
}

/** The `-Proof` ValidateSet of scripts/runLocalConvexProof.ps1, the one proof list. */
export function runnerProofs(runnerScript) {
  const set = /\[ValidateSet\(([^)]*)\)\]\[string\]\$Proof\b/.exec(runnerScript)?.[1]
  if (!set) throw new Error('runLocalConvexProof.ps1 has no -Proof ValidateSet.')
  return proofNames([...set.matchAll(/'([^']*)'/g)].map(([, name]) => name).join(' '))
}

/**
 * The runner proofs that drive Convex and the Worker without the web app, so no web app is started for
 * them. Every other runner proof drives the served web app.
 */
export const NATIVE_PROOFS = [
  'encounter-blueprints',
  'character-concurrency',
  'receipt-ledgers',
  'notification-delivery',
  'session-control',
  'campaign-inventory',
  'equipment-capacity',
  'equipment-character',
  'publication',
  'publication-class',
  'publication-feat',
  'publication-equipment',
  'encounter-lifecycle',
  'checkpoint',
  'checkpoint-large',
  'encounter-action-contention',
  'encounter-reaction-contention',
  'campaign-item-producers',
  'campaign-vehicle-producers',
  'campaign-inventory-read-probe',
  'campaign-membership-custody',
  'campaign-currency-lifecycle',
  'campaign-assignment-lifecycle',
  'campaign-qualified-currency',
  'campaign-custody-authored-delete'
]

/** Workloads that record performance and gate on staging (D210, PERF-2), so CI never runs them. */
export const RECORD_ONLY_PROOFS = ['v15-workload']

/** The CI proofs: every runner proof but the record-only workloads (D213). */
export const ciProofsOf = (runnerScript) =>
  runnerProofs(runnerScript).filter((name) => !RECORD_ONLY_PROOFS.includes(name))
