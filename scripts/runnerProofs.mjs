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

/** The `-Proof` ValidateSet of scripts/runLocalConvexProof.ps1, the one proof list; its *-browser proofs are the CI proofs. */
export function runnerProofs(runnerScript) {
  const set = /\[ValidateSet\(([^)]*)\)\]\[string\]\$Proof\b/.exec(runnerScript)?.[1]
  if (!set) throw new Error('runLocalConvexProof.ps1 has no -Proof ValidateSet.')
  return proofNames([...set.matchAll(/'([^']*)'/g)].map(([, name]) => name).join(' '))
}

/** The CI proofs: the runner's *-browser proofs. */
export const ciProofsOf = (runnerScript) =>
  runnerProofs(runnerScript).filter((name) => name.endsWith('-browser'))
