/**
 * Printed SRD Creature actions, reactions and legendary actions that knowingly author no Effect,
 * keyed by `Creature label|actions Name` (or `|reactions Name`, `|legendaryActions Name`) as the
 * stat-block audit (creatureStatBlocks.test.ts) reports them, each with its reason. Every other
 * printed action must author an Effect, so a printed attack can't silently lack one (D61). The
 * audit fails when an entry no longer applies.
 */

const UNMODELED =
  'The printed mechanics have no model yet, so the GM resolves the printed text (mechanics follow-up, D60).'
const DESCRIPTION_ONLY =
  'The printed text changes no state the product resolves, so the action is description-only (D156, class C).'

const entries = (reason: string, keys: readonly string[]) =>
  keys.map((key) => [key, reason] as const)

export const SRD_CREATURE_DESCRIPTION_ONLY_ACTIONS: ReadonlyMap<string, string> = new Map([
  ...entries(UNMODELED, [
    // Swallowing a grappled target.
    'Behir|actions Swallow',
    // Reading surface thoughts.
    'Doppelganger|actions Read Thoughts',
    // A 5-foot-radius sphere at a point, which waits on area targeting.
    'Gibbering Mouther|actions Blinding Spittle (Recharge 5-6)',
    // Charming every humanoid within 300 feet that hears the song.
    'Harpy|actions Luring Song',
    'Kraken|actions Fling',
    'Otyugh|actions Tentacle Slam',
    'Shrieker|reactions Shriek',
    'Solar|actions Flying Sword',
    'Stone Giant|reactions Rock Catching',
    'Succubus/Incubus|actions Etherealness',
    'Androsphinx|legendaryActions Cast a Spell (Costs 3 Actions)',
    'Lich|legendaryActions Frightening Gaze (Costs 2 Actions)',
    'Lich|legendaryActions Disrupt Life (Costs 3 Actions)',
    // A choice between two actions, which one actionReference can't name.
    'Mummy Lord|legendaryActions Attack',
    'Mummy Lord|legendaryActions Blinding Dust',
    'Mummy Lord|legendaryActions Blasphemous Word (Costs 2 Actions)',
    'Mummy Lord|legendaryActions Channel Negative Energy (Costs 2 Actions)',
    'Mummy Lord|legendaryActions Whirlwind of Sand (Costs 2 Actions)'
  ]),
  ...entries(DESCRIPTION_ONLY, [
    'Black Pudding|reactions Split',
    'Ochre Jelly|reactions Split',
    'Adult Black Dragon|legendaryActions Detect',
    'Adult Blue Dragon|legendaryActions Detect',
    'Adult Brass Dragon|legendaryActions Detect',
    'Adult Bronze Dragon|legendaryActions Detect',
    'Adult Copper Dragon|legendaryActions Detect',
    'Adult Gold Dragon|legendaryActions Detect',
    'Adult Green Dragon|legendaryActions Detect',
    'Adult Red Dragon|legendaryActions Detect',
    'Adult Silver Dragon|legendaryActions Detect',
    'Adult White Dragon|legendaryActions Detect',
    'Ancient Black Dragon|legendaryActions Detect',
    'Ancient Blue Dragon|legendaryActions Detect',
    'Ancient Brass Dragon|legendaryActions Detect',
    'Ancient Bronze Dragon|legendaryActions Detect',
    'Ancient Copper Dragon|legendaryActions Detect',
    'Ancient Gold Dragon|legendaryActions Detect',
    'Ancient Green Dragon|legendaryActions Detect',
    'Ancient Red Dragon|legendaryActions Detect',
    'Ancient Silver Dragon|legendaryActions Detect',
    'Ancient White Dragon|legendaryActions Detect',
    'Green Hag|actions Illusory Appearance',
    'Sea Hag|actions Illusory Appearance'
  ])
])
