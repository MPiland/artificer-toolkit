import { readFileSync } from 'node:fs'

// The source ledger is intentionally consumed by generation scripts as well as built packages.
const LEDGER_URL = new URL('../../../src/source-data/srd/semantic-ledger.json', import.meta.url)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type SrdSemanticLedgerEntry = {
  domain: string
  id: string
  mechanicsStatus: 'COMPLETE' | 'COMPLETE_WITH_MANUAL_EXCEPTIONS' | 'NOT_APPLICABLE'
  manualExceptionIds: string[]
}

function requireUuid(value: unknown, context: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`${context} must be a UUID.`)
  return value.toLowerCase()
}

/** Source identity and exception ownership only; this is never a mechanics classifier. */
export function readSrdSemanticLedgerEntries(): readonly SrdSemanticLedgerEntry[] {
  const parsed = JSON.parse(readFileSync(LEDGER_URL, 'utf8')) as { entries?: unknown }
  if (!Array.isArray(parsed.entries)) throw new Error('SRD semantic ledger is invalid.')
  const seen = new Set<string>()
  return parsed.entries.map((value) => {
    if (!value || typeof value !== 'object')
      throw new Error('SRD semantic ledger entry is invalid.')
    const entry = value as Record<string, unknown>
    if (typeof entry.domain !== 'string') throw new Error('SRD semantic ledger domain is invalid.')
    if (
      entry.mechanicsStatus !== 'COMPLETE' &&
      entry.mechanicsStatus !== 'COMPLETE_WITH_MANUAL_EXCEPTIONS' &&
      entry.mechanicsStatus !== 'NOT_APPLICABLE'
    ) {
      throw new Error(`SRD semantic ledger ${entry.domain} has an invalid mechanics status.`)
    }
    if (!Array.isArray(entry.manualExceptionIds))
      throw new Error('SRD manual exceptions are invalid.')
    const id = requireUuid(entry.id, 'SRD semantic ledger root')
    const key = `${entry.domain}:${id}`
    if (seen.has(key)) throw new Error(`SRD semantic ledger has duplicate root ${key}.`)
    seen.add(key)
    return {
      domain: entry.domain,
      id,
      mechanicsStatus: entry.mechanicsStatus,
      manualExceptionIds: entry.manualExceptionIds.map((id) =>
        requireUuid(id, 'SRD manual exception')
      )
    }
  })
}
