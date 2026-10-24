import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared'
import { describe, expect, it } from 'vitest'
import { srdCreatures } from './creatures/index.js'
import { srdRaces } from './races/index.js'

/**
 * The racial trait and creature closed rules that only restated a description, a sibling grant or
 * the authored spell grants, or that nothing referenced (D156, SPELLS-32.T2 and SPELLS-33.T2a/T2b,
 * class C). Their features keep the description; the kinds and their CLOSED_RULE outcomes are gone.
 */
const RACE_KINDS = [
  'RACE_ARTIFICERS_LORE',
  'RACE_DWARF_HEAVY_ARMOR_SPEED',
  'RACE_NATURALLY_STEALTHY',
  'RACE_STONECUNNING',
  'RACE_TINKER',
  'RACE_TRANCE'
]

const CREATURE_KINDS = [
  'CREATURE_ABOLETH_MUCOUS_CLOUD',
  'CREATURE_AMORPHOUS',
  'CREATURE_AMPHIBIOUS',
  'CREATURE_BRUTE',
  'CREATURE_CHUUL_SENSE_MAGIC',
  'CREATURE_CLAY_GOLEM_BERSERK',
  'CREATURE_CLAY_GOLEM_SLAM',
  'CREATURE_CLOAKER_BITE',
  'CREATURE_COUATL_CONSTRICT',
  'CREATURE_COUATL_INNATE_SPELLCASTING',
  'CREATURE_COUATL_SHIELDED_MIND',
  'CREATURE_DEATH_DOG_DISEASE',
  'CREATURE_DARKMANTLE_FALSE_APPEARANCE',
  'CREATURE_DEEP_GNOME_INNATE_SPELLCASTING',
  'CREATURE_DEEP_GNOME_STONE_CAMOUFLAGE',
  'CREATURE_DEVA_INNATE_SPELLCASTING',
  'CREATURE_DJINNI_ELEMENTAL_DEMISE',
  'CREATURE_DJINNI_INNATE_SPELLCASTING',
  'CREATURE_DRIDER_INNATE_SPELLCASTING',
  'CREATURE_DROW_INNATE_SPELLCASTING',
  'CREATURE_DRYAD_INNATE_SPELLCASTING',
  'CREATURE_DRYAD_SHILLELAGH_CLUB_DAMAGE',
  'CREATURE_DRYAD_SPEAK_WITH_BEASTS_AND_PLANTS',
  'CREATURE_DUERGAR_ENLARGED_JAVELIN_DAMAGE',
  'CREATURE_DUERGAR_ENLARGED_WAR_PICK_DAMAGE',
  'CREATURE_EFREETI_ELEMENTAL_DEMISE',
  'CREATURE_EFREETI_INNATE_SPELLCASTING',
  'CREATURE_FALSE_APPEARANCE',
  'CREATURE_FLESH_GOLEM_BERSERK',
  'CREATURE_GELATINOUS_CUBE_TRANSPARENT',
  'CREATURE_GHOST_ETHEREAL_SIGHT',
  'CREATURE_GIANT_OCTOPUS_TENTACLES',
  'CREATURE_GLABREZU_INNATE_SPELLCASTING',
  'CREATURE_GLABREZU_PINCER_GRAPPLE',
  'CREATURE_GREEN_HAG_ILLUSORY_APPEARANCE',
  'CREATURE_GREEN_HAG_INNATE_SPELLCASTING',
  'CREATURE_GREEN_HAG_MIMICRY',
  'CREATURE_HOLD_BREATH',
  'CREATURE_HYDRA_MULTIPLE_HEADS',
  'CREATURE_HYDRA_WAKEFUL',
  'CREATURE_INNATE_SPELLCASTING',
  'CREATURE_KRAKEN_AMPHIBIOUS',
  'CREATURE_KRAKEN_LIGHTNING_STORM',
  'CREATURE_LAMIA_INNATE_SPELLCASTING',
  'CREATURE_LEGENDARY_RESISTANCE',
  'CREATURE_LICH_TURN_RESISTANCE',
  'CREATURE_MERROW_AMPHIBIOUS',
  'CREATURE_MIMIC_FALSE_APPEARANCE_OBJECT_FORM_ONLY',
  'CREATURE_MUMMY_LORD_LEGENDARY_ACTIONS',
  'CREATURE_MUMMY_LORD_ROTTING_FIST',
  'CREATURE_MUMMY_ROTTING_FIST',
  'CREATURE_NIGHT_HAG_INNATE_SPELLCASTING',
  'CREATURE_OCHRE_JELLY_AMORPHOUS',
  'CREATURE_OCTOPUS_HOLD_BREATH',
  'CREATURE_OCTOPUS_TENTACLES',
  'CREATURE_OCTOPUS_UNDERWATER_CAMOUFLAGE',
  'CREATURE_ONI_INNATE_SPELLCASTING',
  'CREATURE_ON_HIT_FORCED_MOVEMENT_SAVE',
  'CREATURE_ON_HIT_POISON_SAVE',
  'OOZE_SPLIT',
  'CREATURE_PEGASUS_LANGUAGE_LIMITATION',
  'CREATURE_PIT_FIEND_INNATE_SPELLCASTING',
  'CREATURE_PLANETAR_DIVINE_AWARENESS',
  'CREATURE_PLANETAR_INNATE_SPELLCASTING',
  'CREATURE_PURPLE_WORM_TAIL_STINGER',
  'CREATURE_PURPLE_WORM_TUNNELER',
  'CREATURE_QUASIT_CLAWS',
  'CREATURE_QUASIT_SCARE',
  'CREATURE_RAKSHASA_CLAW',
  'CREATURE_RAKSHASA_INNATE_SPELLCASTING',
  'CREATURE_RAKSHASA_LIMITED_MAGIC_IMMUNITY',
  'CREATURE_SHIELD_GUARDIAN_SPELL_STORING',
  'CREATURE_TARRASQUE_REFLECTIVE_CARAPACE',
  'CREATURE_ROPER_FALSE_APPEARANCE',
  'CREATURE_ROPER_GRASPING_TENDRILS',
  'CREATURE_RUG_OF_SMOTHERING_FALSE_APPEARANCE',
  'CREATURE_RUG_OF_SMOTHERING_SMOTHER',
  'CREATURE_SEA_HAG_AMPHIBIOUS',
  'CREATURE_SEA_HAG_ILLUSORY_APPEARANCE',
  'CREATURE_SHADOW_AMORPHOUS',
  'CREATURE_SHADOW_STRENGTH_DRAIN',
  'CREATURE_SPELLCASTING_SLOTS',
  'CREATURE_SPIRIT_NAGA_BITE_POISON',
  'CREATURE_SPIRIT_NAGA_SPELLCASTING',
  'CREATURE_SPRITE_HEART_SIGHT',
  'CREATURE_STORM_GIANT_INNATE_SPELLCASTING',
  'CREATURE_SUCCUBUS_INCUBUS_TELEPATHIC_BOND',
  'CREATURE_TREANT_FALSE_APPEARANCE',
  'CREATURE_UNDERWATER_CAMOUFLAGE',
  'CREATURE_UNICORN_INNATE_SPELLCASTING',
  'CREATURE_VAMPIRE_FORBIDDANCE',
  'CREATURE_VAMPIRE_HARMED_BY_RUNNING_WATER',
  'CREATURE_VAMPIRE_STAKE_TO_THE_HEART',
  'CREATURE_WILL_O_WISP_EPHEMERAL',
  'CREATURE_YOUNG_WHITE_DRAGON_ICE_WALK',
  'DRAGON_LEGENDARY_DETECT',
  'GIANT_RAT_DISEASED_BITE',
  'NIGHT_HAG_NIGHTMARE_HAUNTING'
]

type Node = Record<string, unknown>

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null

/** Every node below `value` (inclusive) that satisfies `match`, depth first. */
function nodesWhere(value: unknown, match: (node: Node) => boolean): Node[] {
  if (Array.isArray(value)) return value.flatMap((entry) => nodesWhere(entry, match))
  if (!isNode(value)) return []
  const own = match(value) ? [value] : []
  return [...own, ...Object.values(value).flatMap((entry) => nodesWhere(entry, match))]
}

describe.each([
  { corpus: 'race', subjects: srdRaces, kinds: RACE_KINDS },
  { corpus: 'creature', subjects: srdCreatures, kinds: CREATURE_KINDS }
])('description-only SRD $corpus closed rules (D156, class C)', ({ subjects, kinds }) => {
  it('authors no closed rule of these kinds', () => {
    const removed = new Set(kinds)
    expect(
      nodesWhere(
        subjects,
        (node) => typeof node.ruleKind === 'string' && removed.has(node.ruleKind)
      )
    ).toEqual([])
  })

  it('keeps a description on every feature', () => {
    const features = nodesWhere(subjects, (node) => Array.isArray(node.features)).flatMap(
      (node) => node.features as unknown[]
    )
    expect(features.length).toBeGreaterThan(0)
    expect(
      features.filter(
        (feature) => !isNode(feature) || String(feature.description ?? '').trim() === ''
      )
    ).toEqual([])
  })

  it('leaves none of their closed rule kinds', () => {
    const remaining = Object.keys(CLOSED_RULE_KIND)
    expect(kinds.filter((kind) => remaining.includes(kind))).toEqual([])
  })
})

describe('curses and afflictions as GM rulings (D187a, SPELLS-33.T6b1)', () => {
  it.each([
    ['Mummy', 'Rotting Fist'],
    ['Mummy Lord', 'Rotting Fist'],
    ['Rakshasa', 'Claw'],
    ['Night Hag', 'Nightmare Haunting (1/Day)']
  ])('%s: %s carries its curse as a manual adjudication', (creature, feature) => {
    const authored = srdCreatures.find((entry) => entry.label === creature)
    const owner = authored?.features?.find((entry) => entry.label === feature)
    const rulings = nodesWhere(owner, (node) => node.effectKind === 'MANUAL_ADJUDICATION')
    expect(rulings).toHaveLength(1)
    expect(String(rulings[0]?.instructions)).toMatch(/remove curse|greater restoration|no benefit/i)
  })
})

describe('disease as a GM ruling (D187a, SPELLS-33.T6b3)', () => {
  it.each([
    ['Aboleth', 'Mucous Cloud'],
    ['Death Dog', 'Bite']
  ])('%s: %s carries its disease as a manual adjudication', (creature, feature) => {
    const authored = srdCreatures.find((entry) => entry.label === creature)
    const owner = authored?.features?.find((entry) => entry.label === feature)
    const rulings = nodesWhere(owner, (node) => node.effectKind === 'MANUAL_ADJUDICATION')
    expect(rulings).toHaveLength(1)
    expect(String(rulings[0]?.instructions)).toMatch(/disease/i)
  })
})

describe('terrain and underwater riders as GM rulings (D187a, SPELLS-33.T6d2)', () => {
  it.each([
    ['Deep Gnome (Svirfneblin)', 'Stone Camouflage', /rocky terrain/i],
    ['Octopus', 'Underwater Camouflage', /underwater/i],
    ['Giant Octopus', 'Underwater Camouflage', /underwater/i],
    ['Vampire', 'Harmed by Running Water', /20 acid damage.*running water/i],
    ['Young White Dragon', 'Ice Walk', /ice or snow/i]
  ])('%s: %s is one manual adjudication and nothing automated', (creature, feature, rider) => {
    const authored = srdCreatures.find((entry) => entry.label === creature)
    const owner = authored?.features?.find((entry) => entry.label === feature)
    const outcomes = nodesWhere(owner, (node) => typeof node.effectKind === 'string')
    expect(outcomes.map((node) => node.effectKind)).toEqual(['MANUAL_ADJUDICATION'])
    expect(String(outcomes[0]?.instructions)).toMatch(rider)
  })
})
