export type ParsedModifierDomainKey = {
  valueDomainCode: string
  modifierKind: string
  params: Record<string, string>
}

export function buildModifierDomainKey(
  valueDomainCode: string,
  modifierKind: string,
  domain?: Record<string, unknown>
): string {
  const entries = Object.entries(domain ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))

  if (entries.length === 0) {
    return `${valueDomainCode}:${modifierKind}`
  }

  const paramKey = entries
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('|')

  return `${valueDomainCode}:${modifierKind}|${paramKey}`
}

export function parseModifierDomainKey(domainKey: string): ParsedModifierDomainKey {
  const [head, ...paramParts] = domainKey.split('|')
  const [valueDomainCode = 'UNKNOWN', modifierKind = 'BONUS'] = head.split(':')

  const params = Object.fromEntries(
    paramParts
      .map((part) => {
        const separator = part.indexOf('=')
        if (separator < 0) return null
        return [part.slice(0, separator), part.slice(separator + 1)]
      })
      .filter((entry): entry is [string, string] => entry !== null)
  )

  return { valueDomainCode, modifierKind, params }
}
