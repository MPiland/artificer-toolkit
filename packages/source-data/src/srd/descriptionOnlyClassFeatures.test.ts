import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared'
import { describe, expect, it } from 'vitest'
import { srdClasses } from './classes/index.js'

type Node = Record<string, unknown>

/**
 * The class and subclass features whose closed rule only restated their description or a sibling
 * grant (D156, SPELLS-31.T2, class C). `grant` marks a feature whose resolved part is already an
 * authored grant on the same node; `description` marks one that changes no resolved state.
 */
const DESCRIPTION_ONLY_FEATURES: ReadonlyArray<{
  owner: string
  feature: string
  kind: string
  resolvedBy: 'grant' | 'description'
}> = [
  {
    owner: 'Barbarian',
    feature: 'Unarmored Defense',
    kind: 'BARBARIAN_UNARMORED_DEFENSE',
    resolvedBy: 'grant'
  },
  {
    owner: 'Barbarian',
    feature: 'Feral Instinct',
    kind: 'BARBARIAN_FERAL_INSTINCT',
    resolvedBy: 'grant'
  },
  {
    owner: 'Barbarian',
    feature: 'Indomitable Might',
    kind: 'BARBARIAN_INDOMITABLE_MIGHT',
    resolvedBy: 'description'
  },
  {
    owner: 'Monk',
    feature: 'Unarmored Defense',
    kind: 'MONK_UNARMORED_DEFENSE',
    resolvedBy: 'grant'
  },
  {
    owner: 'Monk',
    feature: 'Unarmored Movement',
    kind: 'MONK_UNARMORED_MOVEMENT',
    resolvedBy: 'grant'
  },
  {
    owner: 'Monk',
    feature: 'Timeless Body',
    kind: 'MONK_TIMELESS_BODY',
    resolvedBy: 'description'
  },
  {
    owner: 'Monk',
    feature: 'Tongue of the Sun and Moon',
    kind: 'MONK_TONGUE_OF_SUN_AND_MOON',
    resolvedBy: 'description'
  },
  {
    owner: 'Fighter',
    feature: 'Defense',
    kind: 'FIGHTER_FIGHTING_STYLE_DEFENSE',
    resolvedBy: 'grant'
  },
  {
    owner: 'Fighter',
    feature: 'Dueling',
    kind: 'FIGHTER_FIGHTING_STYLE_DUELING',
    resolvedBy: 'grant'
  },
  { owner: 'Champion', feature: 'Dueling', kind: 'CHAMPION_DUELING', resolvedBy: 'grant' },
  {
    owner: 'Paladin',
    feature: 'Dueling',
    kind: 'PALADIN_FIGHTING_STYLE_DUELING',
    resolvedBy: 'grant'
  },
  {
    owner: 'Paladin',
    feature: 'Divine Health',
    kind: 'PALADIN_DIVINE_HEALTH',
    resolvedBy: 'description'
  },
  {
    owner: 'Ranger',
    feature: 'Dueling',
    kind: 'RANGER_FIGHTING_STYLE_DUELING',
    resolvedBy: 'grant'
  },
  {
    owner: 'Ranger',
    feature: 'Natural Explorer',
    kind: 'RANGER_NATURAL_EXPLORER',
    resolvedBy: 'description'
  },
  {
    owner: 'Ranger',
    feature: 'Natural Explorer Improvement',
    kind: 'RANGER_NATURAL_EXPLORER',
    resolvedBy: 'description'
  },
  {
    owner: 'Draconic Bloodline',
    feature: 'Draconic Resilience',
    kind: 'DRACONIC_BLOODLINE_DRACONIC_RESILIENCE',
    resolvedBy: 'grant'
  },
  {
    owner: 'College of Lore',
    feature: 'Bonus Proficiencies',
    kind: 'COLLEGE_OF_LORE_ADDITIONAL_MAGICAL_SECRETS',
    resolvedBy: 'grant'
  },
  { owner: 'Rogue', feature: "Thieves' Cant", kind: 'ROGUE_THIEVES_CANT', resolvedBy: 'grant' },
  { owner: 'Druid', feature: 'Druidic', kind: 'DRUID_DRUIDIC_MESSAGES', resolvedBy: 'grant' },
  {
    owner: 'Druid',
    feature: 'Timeless Body',
    kind: 'DRUID_TIMELESS_BODY',
    resolvedBy: 'description'
  },
  {
    owner: 'Warlock',
    feature: 'Armor of Shadows',
    kind: 'WARLOCK_ARMOR_OF_SHADOWS_COMPONENTS',
    resolvedBy: 'grant'
  },
  {
    owner: 'Warlock',
    feature: 'Fiendish Vigor',
    kind: 'WARLOCK_FIENDISH_VIGOR_COMPONENTS',
    resolvedBy: 'grant'
  },
  {
    owner: 'Warlock',
    feature: 'Misty Visions',
    kind: 'WARLOCK_MISTY_VISIONS_COMPONENTS',
    resolvedBy: 'grant'
  },
  {
    owner: 'Warlock',
    feature: 'Otherworldly Leap',
    kind: 'WARLOCK_OTHERWORLDLY_LEAP_COMPONENTS',
    resolvedBy: 'grant'
  },
  {
    owner: 'Warlock',
    feature: 'Book of Ancient Secrets',
    kind: 'WARLOCK_BOOK_OF_ANCIENT_SECRETS',
    resolvedBy: 'grant'
  },
  {
    owner: 'Warlock',
    feature: 'Pact of the Tome',
    kind: 'WARLOCK_PACT_OF_TOME',
    resolvedBy: 'grant'
  },
  {
    owner: 'Warlock',
    feature: 'Eyes of the Rune Keeper',
    kind: 'WARLOCK_EYES_OF_RUNE_KEEPER',
    resolvedBy: 'description'
  },
  { owner: 'Wizard', feature: 'Spell Mastery', kind: 'WIZARD_SPELL_MASTERY', resolvedBy: 'grant' },
  {
    owner: 'Thief',
    feature: 'Use Magic Device',
    kind: 'THIEF_USE_MAGIC_DEVICE',
    resolvedBy: 'description'
  },
  {
    owner: 'School of Evocation',
    feature: 'Evocation Savant',
    kind: 'SCHOOL_OF_EVOCATION_EVOCATION_SAVANT',
    resolvedBy: 'description'
  }
]

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null

/** Every node below `value` (inclusive) that satisfies `match`, depth first. */
function nodesWhere(value: unknown, match: (node: Node) => boolean): Node[] {
  if (Array.isArray(value)) return value.flatMap((entry) => nodesWhere(entry, match))
  if (!isNode(value)) return []
  const own = match(value) ? [value] : []
  return [...own, ...Object.values(value).flatMap((entry) => nodesWhere(entry, match))]
}

const hasGrant = (node: Node) =>
  isNode(node.grants) &&
  Object.values(node.grants).some((entry) => Array.isArray(entry) && entry.length > 0)

describe('description-only SRD class features (D156, SPELLS-31.T2, class C)', () => {
  it.each(DESCRIPTION_ONLY_FEATURES)(
    '$owner $feature keeps its description and no closed rule',
    ({ owner, feature, resolvedBy }) => {
      const characterClass = srdClasses.find((entry) => entry.label === owner)
      if (!characterClass) throw new Error(`${owner} is not in the SRD corpus`)
      const [node] = nodesWhere(characterClass, (candidate) => candidate.label === feature)
      if (!node) throw new Error(`${owner} has no ${feature}`)
      expect(nodesWhere(node, (candidate) => candidate.effectKind === 'CLOSED_RULE')).toEqual([])
      expect(String(node.description ?? '').trim().length).toBeGreaterThan(0)
      expect(hasGrant(node)).toBe(resolvedBy === 'grant')
    }
  )

  it('leaves none of their closed rule kinds', () => {
    const kinds = Object.keys(CLOSED_RULE_KIND)
    expect(
      DESCRIPTION_ONLY_FEATURES.map(({ kind }) => `CLASS_${kind}`).filter((kind) =>
        kinds.includes(kind)
      )
    ).toEqual([])
  })
})
