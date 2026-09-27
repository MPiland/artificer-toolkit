/**
 * Authored SRD Creature fields that knowingly differ from their printed stat block, keyed by
 * `Creature label|field` (or `|features ±Name`, `|legendaryActions ±Name`) as the stat-block audit
 * (creatureStatBlocks.test.ts) reports them, each with its reason. The audit fails when an entry no
 * longer applies. Each reason names the follow-up that removes it (D56).
 */

const UNAUTHORED_LEGENDARY =
  'The printed legendary action option is not authored yet; the Creature has no legendary action options, a follow-up (D56).'
const UNREACHABLE_SKILL =
  'A printed skill bonus is neither proficiency nor expertise for the printed challenge rating, and a Creature proficiency grant has no flat bonus (model gap, D56).'
const UNREPRESENTED_DEFENSE =
  'The printed damage defense condition has no model (only bypass by magical, silvered or adamantine attacks), so the SRD import drops it (model gap, D56).'

const UNMODELED_SWARM =
  'A swarm prints the size of its members ("Medium swarm of Tiny beasts"); a Creature has no swarm model, so the swarm is authored as a Medium beast and its Swarm trait is description-only (model gap, D60).'

const entries = (reason: string, keys: readonly string[]) =>
  keys.map((key) => [key, reason] as const)

export const SRD_CREATURE_STAT_BLOCK_EXCEPTIONS: ReadonlyMap<string, string> = new Map([
  ...entries(UNAUTHORED_LEGENDARY, [
    'Aboleth|legendaryActions +Detect',
    'Aboleth|legendaryActions +Tail Swipe',
    'Aboleth|legendaryActions +Psychic Drain (Costs 2 Actions)',
    'Kraken|legendaryActions +Tentacle Attack or Fling',
    'Kraken|legendaryActions +Lightning Storm (Costs 2 Actions)',
    'Kraken|legendaryActions +Ink Cloud (Costs 3 Actions)',
    'Solar|legendaryActions +Teleport',
    'Solar|legendaryActions +Searing Burst (Costs 2 Actions)',
    'Solar|legendaryActions +Blinding Gaze (Costs 3 Actions)',
    'Tarrasque|legendaryActions +Attack',
    'Tarrasque|legendaryActions +Move',
    'Tarrasque|legendaryActions +Chomp (Costs 2 Actions)'
  ]),
  ...entries(UNREACHABLE_SKILL, [
    // Printed with the Veteran's +2 proficiency bonus, not the template's CR 5 (+3).
    'Half-Red Dragon Veteran|skills',
    // Arcana +18 with Intelligence +5 at CR 21 (+7).
    'Lich|skills',
    // Every skill printed with +4 proficiency at CR 5 (+3).
    'Night Hag|skills',
    // Religion +4 with Intelligence +1 at CR 2 (+2).
    'Priest|skills'
  ]),
  ...entries(UNREPRESENTED_DEFENSE, [
    // Resistance to "damage from spells" (the Archmage's precast stoneskin is authored).
    'Archmage|unrepresentedDamageDefenses',
    // Vulnerability to "piercing from magic weapons wielded by good creatures".
    'Rakshasa|unrepresentedDamageDefenses'
  ]),
  ...entries(UNMODELED_SWARM, [
    'Swarm of Bats|swarmOf',
    'Swarm of Insects|swarmOf',
    'Swarm of Poisonous Snakes|swarmOf',
    'Swarm of Quippers|swarmOf',
    'Swarm of Rats|swarmOf',
    'Swarm of Ravens|swarmOf'
  ])
])
