import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules'

/**
 * A reusable definition's document is stored as canonical JSON text: an authored action's effects
 * nest deeper than Convex's 16-level value limit (ADR 0029 does the same for authored versions).
 * The checksum and every reader still see the typed document this decodes to.
 */
export function encodeDefinitionDocument(document: unknown): string {
  return canonicalizeRuleDocument(jsonValueSchema.parse(document))
}

export function decodeDefinitionDocument(documentJson: string | undefined) {
  return documentJson === undefined ? undefined : jsonValueSchema.parse(JSON.parse(documentJson))
}
