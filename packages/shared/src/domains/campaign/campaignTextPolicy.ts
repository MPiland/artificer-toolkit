import type { RuntimeNodeMap } from '../../utils/nodeDefinition.js'
import { profanityMatcher } from '../moderation/profanityMatcher.js'

export type CampaignContentMaturity = 'STANDARD' | 'MATURE'

/** Replaces each matched span with `****`. Matches are sorted by start; an overlapping one extends the span. */
export function maskStandardPlainText(value: string): string {
  let masked = ''
  let cursor = 0
  for (const { startIndex, endIndex } of profanityMatcher.getAllMatches(value, true)) {
    if (startIndex >= cursor) masked += `${value.slice(cursor, startIndex)}****`
    cursor = Math.max(cursor, endIndex + 1)
  }
  return masked + value.slice(cursor)
}

export function maskStandardRichText(value: string): string {
  return value
    .split(/(<[^>]*>)/g)
    .map((part) => (part.startsWith('<') ? part : maskStandardPlainText(part)))
    .join('')
}

export function presentCampaignPlainText(value: string, maturity: CampaignContentMaturity): string {
  return maturity === 'STANDARD' ? maskStandardPlainText(value) : value
}

export function presentCampaignRichText(value: string, maturity: CampaignContentMaturity): string {
  return maturity === 'STANDARD' ? maskStandardRichText(value) : value
}

const structuralTextKeys = new Set([
  'id',
  'kind',
  'code',
  'formula',
  'expression',
  'url',
  'href',
  'userId',
  'systemId'
])

function isDisplayTextKey(key: string): boolean {
  return !structuralTextKeys.has(key) && !key.endsWith('Id') && !key.endsWith('Ids')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function maskNodeMapValue(value: unknown, nodeMap: RuntimeNodeMap): unknown {
  if (!isRecord(value)) return value
  const presented: Record<string, unknown> = { ...value }
  const keyedEntry = nodeMap.keyedBy?.entry
  if (keyedEntry?.kind === 'GROUP') {
    const childMap = typeof keyedEntry.nodes === 'function' ? keyedEntry.nodes() : keyedEntry.nodes
    for (const [key, current] of Object.entries(presented))
      presented[key] = maskNodeMapValue(current, childMap)
  }

  for (const node of Object.values(nodeMap.nodes)) {
    const key = String(node.path[0])
    const current = presented[key]
    if (node.kind === 'INPUT') {
      if (typeof current !== 'string' || !isDisplayTextKey(key)) continue
      if (node.type === 'TEXT') presented[key] = maskStandardPlainText(current)
      if (node.type === 'RICH_TEXT') presented[key] = maskStandardRichText(current)
      continue
    }

    const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes
    if (node.groupKind === 'ARRAY' && Array.isArray(current)) {
      presented[key] = current.map((item) => maskNodeMapValue(item, childMap))
    } else if (node.groupKind === 'OBJECT' && isRecord(current)) {
      presented[key] = maskNodeMapValue(current, childMap)
    }
  }

  return presented
}

export function presentAuthoredSnapshotText(
  snapshot: unknown,
  nodeMap: RuntimeNodeMap,
  maturity: CampaignContentMaturity
): unknown {
  return maturity === 'STANDARD' ? maskNodeMapValue(snapshot, nodeMap) : snapshot
}
