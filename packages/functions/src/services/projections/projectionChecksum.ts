import { canonicalizeJson, checksumCanonicalJson, equalCanonicalJson } from '@artificer-toolkit/db'

export function canonicalizeProjectionJson(value: unknown): string {
  return canonicalizeJson(value)
}

export function checksumProjectionDocument(document: unknown): string {
  return checksumCanonicalJson(document)
}

export function equalProjectionDocuments(left: unknown, right: unknown): boolean {
  return equalCanonicalJson(left, right)
}
