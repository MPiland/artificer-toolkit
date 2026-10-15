const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COPY_KEYS = new Set(['label', 'description', 'summary'])

function collectOwnIds(value: unknown, into: Set<string>) {
  if (Array.isArray(value)) for (const item of value) collectOwnIds(item, into)
  else if (value && typeof value === 'object')
    for (const [key, child] of Object.entries(value)) {
      if (key === 'id' && typeof child === 'string' && UUID.test(child)) into.add(child)
      else collectOwnIds(child, into)
    }
}

function rewrite(value: unknown, ids: ReadonlyMap<string, string>, key = ''): unknown {
  if (Array.isArray(value)) return value.map((item) => rewrite(item, ids))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([name, child]) => [name, rewrite(child, ids, name)])
    )
  if (typeof value !== 'string') return value
  if (ids.has(value)) return ids.get(value)
  return COPY_KEYS.has(key) ? `Homebrew ${value}` : value
}

/**
 * The same authored document as a homebrew author would own it: every id the document defines (and
 * each reference to one) is a fresh id, and its display copy is different. References to ids the
 * document does not define (the System's vocabulary) stay, so only structure carries behavior.
 */
export function homebrewCopy<Document>(document: Document): Document {
  const own = new Set<string>()
  collectOwnIds(document, own)
  const ids = new Map([...own].map((id) => [id, crypto.randomUUID()]))
  return rewrite(document, ids) as Document
}
