import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { srdBaselineContent } from '../source-data/srd/index.js'

const SOURCE_URL = new URL('../source-data/srd/SRD_CC_v5.1.txt', import.meta.url)
const PDF_SOURCE_URL = new URL('../source-data/srd/SRD_CC_v5.1.pdf', import.meta.url)
const LEDGER_URL = new URL('../source-data/srd/semantic-ledger.json', import.meta.url)
const MANUAL_REASON_CODES = new Set([
  'GM_CHOICE',
  'PLAYER_DECLARATION',
  'NARRATIVE_JUDGMENT',
  'EXTERNAL_WORLD_STATE'
])

type TextSourceReference = {
  sourceFile: 'SRD_CC_v5.1.txt'
  startLine: number
  endLine: number
  sha256: string
}

type PdfSourceReference = {
  sourceFile: 'SRD_CC_v5.1.pdf'
  page: number
  sha256: string
}

type SourceReference = TextSourceReference | PdfSourceReference

type SemanticLedgerEntry = {
  domain: string
  id: string
  label: string
  sourceReferences: SourceReference[]
  authoredSha256: string
  proseStatus: 'COMPLETE' | 'NOT_APPLICABLE'
  mechanicsStatus: 'COMPLETE' | 'COMPLETE_WITH_MANUAL_EXCEPTIONS' | 'NOT_APPLICABLE'
  manualExceptionIds: string[]
}

type SemanticLedger = {
  version: 1
  sourceFiles: ['SRD_CC_v5.1.txt', 'SRD_CC_v5.1.pdf']
  sourceSha256: {
    'SRD_CC_v5.1.txt': string
    'SRD_CC_v5.1.pdf': string
  }
  entries: SemanticLedgerEntry[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function canonicalizeForSemanticHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeForSemanticHash)
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizeForSemanticHash(entry)])
  )
}

export function semanticHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalizeForSemanticHash(value)))
    .digest('hex')
}

function collectManualExceptions(value: unknown, errors: string[], path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectManualExceptions(entry, errors, `${path}[${index}]`)
    )
  }
  if (!isRecord(value)) return []

  const ids: string[] = []
  if (value.effectKind === 'MANUAL_ADJUDICATION') {
    if (typeof value.id !== 'string' || !value.id) errors.push(`${path} has no manual exception id.`)
    if (typeof value.label !== 'string' || !value.label.trim()) {
      errors.push(`${path} manual exception has no label.`)
    }
    if (typeof value.instructions !== 'string' || !value.instructions.trim()) {
      errors.push(`${path} manual exception has no complete instructions.`)
    }
    if (typeof value.reasonCode !== 'string' || !MANUAL_REASON_CODES.has(value.reasonCode)) {
      errors.push(`${path} manual exception has an invalid reason code.`)
    }
    if (typeof value.id === 'string' && value.id) ids.push(value.id)
  }

  for (const [key, entry] of Object.entries(value)) {
    ids.push(...collectManualExceptions(entry, errors, `${path}.${key}`))
  }
  return ids
}

const PROSE_KEYS = new Set(['description', 'quote', 'notes', 'speedNote'])

function normalizeSrdProse(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&(?:rsquo|#39);/g, "'")
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\b11\/2\b/g, '1½')
    .replace(/\b21\/2\b/g, '2½')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectAuthoredProse(
  value: unknown,
  path = '$'
): Array<{ path: string; value: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectAuthoredProse(entry, `${path}[${index}]`))
  }
  if (!isRecord(value)) return []

  return Object.entries(value).flatMap(([key, entry]) => {
    const entryPath = `${path}.${key}`
    return [
      ...(PROSE_KEYS.has(key) && typeof entry === 'string' && entry.trim()
        ? [{ path: entryPath, value: entry }]
        : []),
      ...collectAuthoredProse(entry, entryPath)
    ]
  })
}

function hasAuthoredProse(value: unknown): boolean {
  return collectAuthoredProse(value).length > 0
}

function readLedger(): SemanticLedger {
  const value = JSON.parse(readFileSync(LEDGER_URL, 'utf8')) as unknown
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.sourceFiles) ||
    value.sourceFiles.length !== 2 ||
    value.sourceFiles[0] !== 'SRD_CC_v5.1.txt' ||
    value.sourceFiles[1] !== 'SRD_CC_v5.1.pdf' ||
    !isRecord(value.sourceSha256)
  ) {
    throw new Error('The SRD semantic ledger header is invalid.')
  }
  if (!Array.isArray(value.entries)) throw new Error('The SRD semantic ledger has no entries.')
  return value as SemanticLedger
}

function hashSourceSpan(lines: string[], span: TextSourceReference): string {
  return createHash('sha256')
    .update(lines.slice(span.startLine - 1, span.endLine).join('\n'))
    .digest('hex')
}

export function auditSrdSemanticLedger(): { roots: number; manualExceptions: number } {
  const ledger = readLedger()
  const sourceText = readFileSync(SOURCE_URL, 'utf8').replace(/\r\n/g, '\n')
  const sourceLines = sourceText.split('\n')
  const normalizedSourceText = normalizeSrdProse(sourceText)
  const textSourceHash = createHash('sha256').update(sourceText).digest('hex')
  const pdfSourceHash = createHash('sha256').update(readFileSync(PDF_SOURCE_URL)).digest('hex')
  const records = Object.entries(srdBaselineContent.subjects).flatMap(([domain, roots]) =>
    roots.map((record: { id: string; label: string } & Record<string, unknown>) => ({
      domain,
      record
    }))
  )
  const errors: string[] = []
  const entriesByKey = new Map<string, SemanticLedgerEntry>()

  if (ledger.sourceSha256['SRD_CC_v5.1.txt'] !== textSourceHash) {
    errors.push('The tracked SRD text source hash is stale.')
  }
  if (ledger.sourceSha256['SRD_CC_v5.1.pdf'] !== pdfSourceHash) {
    errors.push('The tracked SRD PDF source hash is stale.')
  }

  for (const entry of ledger.entries) {
    const key = `${entry.domain}:${entry.id}`
    if (entriesByKey.has(key)) errors.push(`Duplicate ledger entry ${key}.`)
    entriesByKey.set(key, entry)
  }

  const recordKeys = new Set(records.map(({ domain, record }) => `${domain}:${record.id}`))
  for (const key of entriesByKey.keys()) {
    if (!recordKeys.has(key)) errors.push(`Unmatched ledger entry ${key}.`)
  }

  let manualExceptionCount = 0
  const manualExceptionOwners = new Map<string, string>()
  for (const { domain, record } of records) {
    const key = `${domain}:${record.id}`
    const entry = entriesByKey.get(key)
    if (!entry) {
      errors.push(`Missing ledger entry ${key} (${record.label}).`)
      continue
    }
    if (entry.label !== record.label) errors.push(`${key} has stale label "${entry.label}".`)
    if (entry.proseStatus !== 'COMPLETE' && entry.proseStatus !== 'NOT_APPLICABLE') {
      errors.push(`${key} has an invalid prose status.`)
    }
    const authoredHasProse = hasAuthoredProse(record)
    if (authoredHasProse && entry.proseStatus !== 'COMPLETE') {
      errors.push(`${key} contains prose without a COMPLETE prose status.`)
    }
    if (!authoredHasProse && entry.proseStatus !== 'NOT_APPLICABLE') {
      errors.push(`${key} has no prose but is not marked NOT_APPLICABLE.`)
    }
    const hasPdfSource = entry.sourceReferences?.some(
      (reference) => reference.sourceFile === 'SRD_CC_v5.1.pdf'
    )
    for (const prose of collectAuthoredProse(record)) {
      if (!normalizedSourceText.includes(normalizeSrdProse(prose.value)) && !hasPdfSource) {
        errors.push(`${key} has non-verbatim SRD prose at ${prose.path}.`)
      }
    }
    if (
      entry.mechanicsStatus !== 'COMPLETE' &&
      entry.mechanicsStatus !== 'COMPLETE_WITH_MANUAL_EXCEPTIONS' &&
      entry.mechanicsStatus !== 'NOT_APPLICABLE'
    ) {
      errors.push(`${key} has an invalid mechanics status.`)
    }
    if (!Array.isArray(entry.sourceReferences) || entry.sourceReferences.length === 0) {
      errors.push(`${key} has no SRD source reference.`)
    } else {
      for (const reference of entry.sourceReferences) {
        if (reference.sourceFile === 'SRD_CC_v5.1.txt') {
          if (
            !Number.isInteger(reference.startLine) ||
            !Number.isInteger(reference.endLine) ||
            reference.startLine < 1 ||
            reference.endLine < reference.startLine ||
            reference.endLine > sourceLines.length
          ) {
            errors.push(
              `${key} has an invalid source span ${reference.startLine}-${reference.endLine}.`
            )
            continue
          }
          if (hashSourceSpan(sourceLines, reference) !== reference.sha256) {
            errors.push(
              `${key} has a stale source hash for lines ${reference.startLine}-${reference.endLine}.`
            )
          }
          continue
        }

        if (reference.sourceFile === 'SRD_CC_v5.1.pdf') {
          if (!Number.isInteger(reference.page) || reference.page < 1) {
            errors.push(`${key} has an invalid PDF page ${reference.page}.`)
          }
          if (reference.sha256 !== pdfSourceHash) {
            errors.push(`${key} has a stale PDF source hash for page ${reference.page}.`)
          }
          continue
        }

        errors.push(`${key} has an unknown SRD source file.`)
      }
    }
    if (semanticHash(record) !== entry.authoredSha256) {
      errors.push(`${key} has a stale authored-data hash.`)
    }

    const manualErrors: string[] = []
    const actualManualIds = collectManualExceptions(record, manualErrors).sort()
    manualExceptionCount += actualManualIds.length
    errors.push(...manualErrors.map((error) => `${key}: ${error}`))
    if (new Set(actualManualIds).size !== actualManualIds.length) {
      errors.push(`${key} contains duplicate manual exception IDs.`)
    }
    for (const manualId of actualManualIds) {
      const existingOwner = manualExceptionOwners.get(manualId)
      if (existingOwner) {
        errors.push(`${key} reuses manual exception ID ${manualId} from ${existingOwner}.`)
      } else {
        manualExceptionOwners.set(manualId, key)
      }
    }
    const allowedManualIds = Array.isArray(entry.manualExceptionIds)
      ? [...entry.manualExceptionIds].sort()
      : []
    if (!Array.isArray(entry.manualExceptionIds)) {
      errors.push(`${key} has no manual exception allowlist.`)
    }
    if (JSON.stringify(actualManualIds) !== JSON.stringify(allowedManualIds)) {
      errors.push(`${key} manual exception allowlist does not match authored data.`)
    }
    if (
      actualManualIds.length > 0 &&
      entry.mechanicsStatus !== 'COMPLETE_WITH_MANUAL_EXCEPTIONS'
    ) {
      errors.push(`${key} contains manual exceptions without the matching mechanics status.`)
    }
    if (
      actualManualIds.length === 0 &&
      entry.mechanicsStatus === 'COMPLETE_WITH_MANUAL_EXCEPTIONS'
    ) {
      errors.push(`${key} claims manual exceptions but contains none.`)
    }
  }

  if (ledger.entries.length !== records.length) {
    errors.push(`Ledger has ${ledger.entries.length} entries for ${records.length} seeded roots.`)
  }
  if (errors.length > 0) {
    throw new Error(`SRD semantic audit failed (${errors.length} issues):\n${errors.join('\n')}`)
  }

  return { roots: records.length, manualExceptions: manualExceptionCount }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (invokedPath === import.meta.url) {
  try {
    const result = auditSrdSemanticLedger()
    console.log(
      `SRD semantic ledger verified ${result.roots} roots and ${result.manualExceptions} manual exceptions.`
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
