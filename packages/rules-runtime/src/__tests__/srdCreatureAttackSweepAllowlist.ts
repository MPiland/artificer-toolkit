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
  // Wereboar: Tusks (Boar or Hybrid Form Only): its curse ruling (T6b2) sits ahead of the merged
  // Charge save (T5n2); `immediateFollowUpSaveEntries` admits only DAMAGE before an immediate save,
  // so the missing piece is a ruling entry ahead of it (ATTACK-5.T4).
  '00000000-0002-0001-0070-1b1100000000': 'FOLLOW_UP_SAVE'
}
