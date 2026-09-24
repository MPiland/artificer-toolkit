import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'

export function canonicalizeRuleDocument(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Rule documents must contain finite numbers.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeRuleDocument).join(',')}]`
  if (typeof value !== 'object') throw new Error('Rule documents must contain JSON values only.')
  return `{${Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalizeRuleDocument(entry)}`)
    .join(',')}}`
}

export function checksumRuleDocument(document: unknown): string {
  return checksumCanonicalRuleDocument(canonicalizeRuleDocument(document))
}

/** Hashes already canonical rules JSON; callers must preserve canonicalizeRuleDocument's bytes. */
export function checksumCanonicalRuleDocument(canonicalJson: string): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalJson)))
}

export function equalCanonicalJson(left: unknown, right: unknown): boolean {
  return canonicalizeRuleDocument(left) === canonicalizeRuleDocument(right)
}
