import { sha256Hex } from './sha256.js'

export type CanonicalJson =
  | boolean
  | null
  | number
  | string
  | CanonicalJson[]
  | { [key: string]: CanonicalJson }

const omit = Symbol('omit')

function normalize(value: unknown, nested = false): CanonicalJson | typeof omit {
  if (value === undefined) {
    if (nested) return omit
    throw new TypeError('Canonical JSON values cannot be undefined.')
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON values must contain finite numbers.')
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const normalized = normalize(entry, true)
      return normalized === omit ? null : normalized
    })
  }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError('Canonical JSON values must contain plain JSON objects only.')
  }

  const normalized: Record<string, CanonicalJson> = {}
  for (const [key, entry] of Object.entries(value)) {
    const nestedValue = normalize(entry, true)
    if (nestedValue !== omit) normalized[key] = nestedValue
  }
  return normalized
}

function canonicalize(value: CanonicalJson): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(',')}}`
}

export function normalizeCanonicalJson(value: unknown): CanonicalJson {
  const normalized = normalize(value)
  if (normalized === omit) throw new TypeError('Canonical JSON values cannot be undefined.')
  return normalized
}

export function canonicalizeJson(value: unknown): string {
  return canonicalize(normalizeCanonicalJson(value))
}

export function checksumCanonicalJson(value: unknown): string {
  return sha256Hex(canonicalizeJson(value))
}

export function equalCanonicalJson(left: unknown, right: unknown): boolean {
  return canonicalizeJson(left) === canonicalizeJson(right)
}
