import { createHash } from 'node:crypto'

function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Rule documents must contain finite numbers.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (typeof value !== 'object') throw new Error('Rule documents must contain JSON values only.')

  return `{${Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(',')}}`
}

export function checksumRuleDocument(document: unknown): string {
  return createHash('sha256').update(canonicalize(document)).digest('hex')
}

export function equalCanonicalJson(left: unknown, right: unknown): boolean {
  return canonicalize(left) === canonicalize(right)
}
