import { describe, expect, it } from 'vitest'
import { srdSpells } from './spells/index.js'

/** "…or half as much damage on a successful one/save" and "On a successful save, it takes half (as much) damage". */
const SAVE_FOR_HALF_TEXT =
  /half as much damage on a successful|successful save, [^.]*takes half (as much )?damage/i

/**
 * Save-for-half spells whose damage is not authored at all yet, so there is no failed-save damage to
 * halve. The list is exact: a spell leaves it the moment its damage is authored, and must then carry
 * the halved success path like every other spell.
 */
const DAMAGE_NOT_AUTHORED: Readonly<Record<string, string>> = {
  'Call Lightning': 'MANUAL_ADJUDICATION: the recurring bolt action is not authored',
  'Control Water': 'MANUAL_ADJUDICATION: the whirlpool is not authored',
  'Delayed Blast Fireball': 'CLOSED_RULE',
  Earthquake: 'CLOSED_RULE',
  'Flaming Sphere': 'MANUAL_ADJUDICATION: the sphere is not authored',
  'Glyph of Warding': 'CLOSED_RULE',
  'Guardian of Faith': 'CLOSED_RULE',
  'Storm of Vengeance': 'CLOSED_RULE',
  Symbol: 'CLOSED_RULE',
  'Wall of Ice': 'ZONE manifest without interactions'
}

type Node = Record<string, unknown>
type Path = { pathCode: string }

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null

/** Every `paths` array in the spell, at any depth (zone components and interactions carry their own). */
function pathGroups(value: unknown): Path[][] {
  if (Array.isArray(value)) return value.flatMap(pathGroups)
  if (!isNode(value)) return []
  const own = Array.isArray(value.paths) ? [value.paths as Path[]] : []
  return [...own, ...Object.values(value).flatMap(pathGroups)]
}

/** The DAMAGE outcomes a path resolves to, table rows included, without entering nested path groups. */
function damageOutcomes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(damageOutcomes)
  if (!isNode(value) || 'paths' in value) return []
  const own = value.effectKind === 'DAMAGE' ? [value] : []
  return [...own, ...Object.values(value).flatMap(damageOutcomes)]
}

const isHalved = (outcome: Node) => outcome.amountKind === 'HALF' || outcome.multiplier === 0.5

/** The roll an outcome makes, with ids and the halving left out, so a halved copy matches its failure. */
function roll(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(roll)
  if (!isNode(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'id' && key !== 'amountKind' && key !== 'multiplier')
      .map(([key, child]) => [key, roll(child)])
  )
}

const rolls = (outcomes: readonly Node[]) =>
  outcomes.map((outcome) => JSON.stringify(roll(outcome))).sort()

function outcomesOn(paths: readonly Path[], pathCode: string) {
  return damageOutcomes(paths.filter((path) => path.pathCode === pathCode))
}

const saveForHalfSpells = srdSpells.filter((spell) =>
  SAVE_FOR_HALF_TEXT.test(spell.description ?? '')
)

/** SPELLS-7.2: a creature that makes its save takes half the damage it would take on a failure. */
describe('SRD spells that deal half damage on a successful save', () => {
  it.each(saveForHalfSpells.map((spell) => [spell.label, spell] as const))(
    '%s halves every failed-save damage roll on a success',
    (label, spell) => {
      const groups = pathGroups(spell.effects).filter(
        (paths) => outcomesOn(paths, 'ON_SAVE_FAIL').length > 0
      )
      if (label in DAMAGE_NOT_AUTHORED) {
        expect(groups).toEqual([])
        return
      }
      expect(groups.length).toBeGreaterThan(0)
      for (const paths of groups) {
        const success = outcomesOn(paths, 'ON_SAVE_SUCCESS')
        expect(success.every(isHalved)).toBe(true)
        expect(rolls(success)).toEqual(rolls(outcomesOn(paths, 'ON_SAVE_FAIL')))
      }
    }
  )

  it('lists only save-for-half spells whose damage is not authored', () => {
    const labels = new Set(saveForHalfSpells.map((spell) => spell.label))
    expect(Object.keys(DAMAGE_NOT_AUTHORED).filter((label) => !labels.has(label))).toEqual([])
  })
})
