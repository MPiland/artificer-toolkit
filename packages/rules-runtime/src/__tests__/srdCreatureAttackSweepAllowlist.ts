/**
 * Why a known SRD Creature attack cannot yet run in the room (D53 ruling 4 follow-up slices; the
 * design notes per category are in docs/architecture/rules-runtime.md, "M9 sweep categories"):
 * - FOLLOW_UP_SAVE: a follow-up save the adapter does not run (a condition that turns into another,
 *   a push-and-prone save, a hit with no damage before its save).
 * - OUTCOME_KIND: a hit rider, or an outcome of its follow-up save, with no typed outcome yet: a
 *   CLOSED_RULE (swallowing, attaching, curses, disease, draining hit points or hit point maximum, a
 *   Strength contest pull) or a choice.
 */
export type SrdCreatureAttackUnsupportedReason = 'FOLLOW_UP_SAVE' | 'OUTCOME_KIND'

/**
 * The SRD Creature attack Effects the sweep expects to fail, keyed by Effect ID. It may only
 * shrink: the sweep fails when a listed attack starts working or an unlisted one fails.
 */
export const SRD_CREATURE_ATTACK_UNSUPPORTED: Readonly<
  Record<string, SrdCreatureAttackUnsupportedReason>
> = {
  // OUTCOME_KIND
  '00000000-0002-00d0-0070-00a700000000': 'OUTCOME_KIND', // Horned Devil: Tail
  '00000000-0002-01f9-0070-00ef00000000': 'OUTCOME_KIND', // Roper: Tendril
  '00000000-0002-00cc-0070-011f00000000': 'OUTCOME_KIND', // Werebear: Bite
  // Wereboar: Tusks (Boar or Hybrid Form Only): its lycanthropy save (T6b2) beside the Charge's (T5n2).
  '00000000-0002-0001-0070-1b1100000000': 'FOLLOW_UP_SAVE',
  '00000000-0002-00cc-0070-012100000000': 'OUTCOME_KIND', // Wererat: Bite (Rat or Hybrid Form Only)
  '00000000-0002-00d3-0070-012200000000': 'OUTCOME_KIND', // Weretiger: Bite (Tiger or Hybrid Form Only)
  '00000000-0002-00cc-0070-012300000000': 'OUTCOME_KIND' // Werewolf: Bite (Wolf or Hybrid Form Only)
}
