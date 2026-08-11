import { CensorType, Profanity } from '@2toad/profanity'
import type { NodeMap } from '../../utils/nodeDefinition.js'

export type CampaignContentMaturity = 'STANDARD' | 'MATURE'

const STANDARD_TEXT_ALLOWLIST = ['hell', 'shitake']
const profanity = new Profanity({
  languages: ['en'],
  wholeWord: true,
  grawlix: '****'
})
profanity.whitelist.addWords(STANDARD_TEXT_ALLOWLIST)

export function maskStandardPlainText(value: string): string {
  return profanity.censor(value.replace(/\bshit(?=storm\b)/gi, '****'), CensorType.Word)
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

function maskNodeMapValue(value: unknown, nodeMap: NodeMap<Record<string, unknown>>): unknown {
  if (!isRecord(value)) return value
  const presented: Record<string, unknown> = { ...value }

  for (const node of Object.values(nodeMap.nodes)) {
    const key = String(node.path[0])
    const current = presented[key]
    if (node.kind === 'INPUT') {
      if (typeof current !== 'string' || !isDisplayTextKey(key)) continue
      if (node.type === 'TEXT') presented[key] = maskStandardPlainText(current)
      if (node.type === 'RICH_TEXT') presented[key] = maskStandardRichText(current)
      continue
    }

    const group = node as unknown as {
      groupKind: 'ARRAY' | 'OBJECT'
      nodes: NodeMap<Record<string, unknown>> | (() => NodeMap<Record<string, unknown>>)
    }
    const childMap = typeof group.nodes === 'function' ? group.nodes() : group.nodes
    if (group.groupKind === 'ARRAY' && Array.isArray(current)) {
      presented[key] = current.map((item) => maskNodeMapValue(item, childMap))
    } else if (group.groupKind === 'OBJECT') {
      presented[key] = maskNodeMapValue(current, childMap)
    }
  }

  return presented
}

export function presentAuthoredSnapshotText(
  snapshot: unknown,
  nodeMap: NodeMap<Record<string, unknown>>,
  maturity: CampaignContentMaturity
): unknown {
  return maturity === 'STANDARD' ? maskNodeMapValue(snapshot, nodeMap) : snapshot
}
