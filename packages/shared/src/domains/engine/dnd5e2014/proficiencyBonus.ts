/**
 * D&D 5e 2014 SRD proficiency bonus by total character level.
 * See RULE_ORDER.md §4 step 5.
 *
 * Level  1–4  → +2
 * Level  5–8  → +3
 * Level  9–12 → +4
 * Level 13–16 → +5
 * Level 17–20 → +6
 */
export function dnd5e2014ProficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2
}
