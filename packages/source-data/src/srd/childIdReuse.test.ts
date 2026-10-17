import { describe, expect, it } from 'vitest'
import { srdSpells } from './spells/index.js'

type Node = Record<string, unknown>

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null

/** The invocation parts that carry their own id: a save (follow-up saves included), a range and a shape. */
const PART_KEYS = new Set(['savingThrow', 'range', 'shape'])

/** Every id in the spell, split into invocation-part ids and path or outcome ids, at any depth. */
function childIds(value: unknown, ids = { parts: [] as string[], results: [] as string[] }) {
  if (Array.isArray(value)) {
    for (const child of value) childIds(child, ids)
    return ids
  }
  if (!isNode(value)) return ids
  if (typeof value.id === 'string' && ('pathCode' in value || 'effectKind' in value))
    ids.results.push(value.id)
  for (const [key, child] of Object.entries(value)) {
    if (PART_KEYS.has(key) && isNode(child) && typeof child.id === 'string')
      ids.parts.push(child.id)
    childIds(child, ids)
  }
  return ids
}

/**
 * SPELLS-7.2: a save, range or shape keeps its own id, never one a path or outcome uses. A path may
 * share its id with its first outcome, as every SRD spell authors it.
 */
describe('SRD spell child ids', () => {
  it.each(srdSpells.map((spell) => [spell.label, spell] as const))(
    '%s reuses no save, range or shape id for a path or outcome',
    (_label, spell) => {
      const { parts, results } = childIds(spell.effects)
      const resultIds = new Set(results)
      expect(parts.filter((id) => resultIds.has(id))).toEqual([])
    }
  )
})
