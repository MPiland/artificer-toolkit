import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared'
import { describe, expect, it } from 'vitest'
import { srdSpells } from './spells/index.js'

/**
 * The spells whose closed rule only restated their description (D156 T2 split, class C). Each
 * resolves to the GM's ruling on its description, and no closed rule remains for any of them.
 */
const DESCRIPTION_ONLY_SPELLS = [
  'Arcane Lock',
  "Arcanist's Magic Aura",
  'Astral Projection',
  'Clone',
  'Comprehend Languages',
  'Demiplane',
  'Detect Thoughts',
  'Disguise Self',
  'Dream',
  'Feather Fall',
  'Gentle Repose',
  'Guards and Wards',
  'Meld into Stone',
  'Mislead',
  'Nondetection',
  'Passwall',
  'Prestidigitation',
  'Private Sanctum',
  'Programmed Illusion',
  'Purify Food and Drink',
  'Rope Trick',
  'Seeming',
  'Sending',
  'Speak with Animals',
  'Speak with Dead',
  'Speak with Plants',
  'Stone Shape',
  'Suggestion',
  'Thaumaturgy',
  'Tongues',
  'Water Breathing',
  'Water Walk',
  'Wish',
  'Zone of Truth'
]

type Node = Record<string, unknown>

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null

/** Every outcome-like node in the spell, at any depth. */
function effectNodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(effectNodes)
  if (!isNode(value)) return []
  const own = typeof value.effectKind === 'string' ? [value] : []
  return [...own, ...Object.values(value).flatMap(effectNodes)]
}

const plainText = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')

const ruleKindKey = (label: string) =>
  label
    .replace(/'/g, '')
    .replace(/[^A-Za-z]+/g, '_')
    .toUpperCase()

describe('description-only SRD spells (D156 T2, class C)', () => {
  it.each(DESCRIPTION_ONLY_SPELLS)('%s resolves to the GM ruling on its description', (label) => {
    const spell = srdSpells.find((candidate) => candidate.label === label)
    if (!spell) throw new Error(`${label} is not in the SRD corpus`)
    const nodes = effectNodes(spell.effects)
    expect(nodes.filter((node) => node.effectKind === 'CLOSED_RULE')).toEqual([])
    const description = plainText(spell.description ?? '')
    expect(description.length).toBeGreaterThan(0)
    const rulings = nodes.filter((node) => node.effectKind === 'MANUAL_ADJUDICATION')
    expect(rulings.length).toBeGreaterThan(0)
    for (const ruling of rulings) {
      expect(typeof ruling.instructions).toBe('string')
      expect(description).toContain(plainText(ruling.instructions as string))
    }
  })

  it('leaves none of their closed rule kinds', () => {
    const kinds = Object.keys(CLOSED_RULE_KIND)
    expect(DESCRIPTION_ONLY_SPELLS.map(ruleKindKey).filter((key) => kinds.includes(key))).toEqual(
      []
    )
  })
})
