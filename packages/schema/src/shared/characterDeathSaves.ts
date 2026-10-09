import type { z } from '../zod.js'
import { NO_DEATH_SAVES, type characterDeathSavesDtoSchema } from '../subjects/characterState.js'

/**
 * The pure dying and death rules (D96, SRD 5.1). Every writer of Character hit points uses these:
 * the Encounter mechanics fold, its receipt replay, the Sheet reducer and Undo. Dying is 0 hit
 * points, not stable and under three failures; dead is three failures, so no separate flag exists.
 */
export type CharacterDeathSaves = z.infer<typeof characterDeathSavesDtoSchema>

export const DEATH_SAVE_LIMIT = 3

const DEAD: CharacterDeathSaves = { successes: 0, failures: DEATH_SAVE_LIMIT, stable: false }

export function isCharacterDead(deathSaves: CharacterDeathSaves): boolean {
  return deathSaves.failures >= DEATH_SAVE_LIMIT
}

/** Dying: at 0 hit points, neither stable nor dead. */
export function isCharacterDying(
  deathSaves: CharacterDeathSaves,
  currentHitPoints: number
): boolean {
  return currentHitPoints === 0 && !deathSaves.stable && !isCharacterDead(deathSaves)
}

/**
 * The death saves after a STABILIZE effect (a Healer's Kit use): a dying Character becomes stable
 * with its counts reset. Any other target is unchanged.
 */
export function deathSavesAfterStabilize(input: {
  deathSaves: CharacterDeathSaves
  currentHitPoints: number
}): CharacterDeathSaves {
  return isCharacterDying(input.deathSaves, input.currentHitPoints)
    ? { successes: 0, failures: 0, stable: true }
    : input.deathSaves
}

/**
 * The death saves after damage reached a Character's hit points. `dealt` is the damage that got
 * past temporary hit points, before it is clamped at 0. Damage that drops a Character to 0 kills
 * it when the overflow is at least its maximum (massive damage); damage at 0 adds a failure (two
 * for a critical hit), kills it at the maximum, and ends stability.
 */
export function deathSavesAfterDamage(input: {
  deathSaves: CharacterDeathSaves
  currentHitPoints: number
  maximumHitPoints: number
  dealt: number
  critical: boolean
}): CharacterDeathSaves {
  const { deathSaves, currentHitPoints, maximumHitPoints, dealt, critical } = input
  if (isCharacterDead(deathSaves) || dealt < 1) return deathSaves
  if (currentHitPoints > 0) return dealt - currentHitPoints >= maximumHitPoints ? DEAD : deathSaves
  if (dealt >= maximumHitPoints) return DEAD
  return {
    successes: deathSaves.successes,
    failures: Math.min(DEATH_SAVE_LIMIT, deathSaves.failures + (critical ? 2 : 1)),
    stable: false
  }
}

/** Regaining any hit points from 0 resets the death saves; a dead Character regains nothing. */
export function deathSavesAfterHealing(input: {
  deathSaves: CharacterDeathSaves
  appliedAmount: number
}): CharacterDeathSaves {
  return input.appliedAmount > 0 && !isCharacterDead(input.deathSaves)
    ? NO_DEATH_SAVES
    : input.deathSaves
}

/**
 * The death saves after a dying Character's death save roll (a d20 with no modifiers). 20 regains
 * 1 hit point, which resets the saves; 10 or more is a success, 2 to 9 a failure and 1 two
 * failures. A third success makes the Character stable (counts reset) and a third failure dead.
 */
export function deathSavesAfterRoll(
  deathSaves: CharacterDeathSaves,
  rawDie: number
): { deathSaves: CharacterDeathSaves; regainsHitPoint: boolean } {
  if (rawDie === 20) return { deathSaves: NO_DEATH_SAVES, regainsHitPoint: true }
  const successes = deathSaves.successes + (rawDie >= 10 ? 1 : 0)
  const failures = Math.min(
    DEATH_SAVE_LIMIT,
    deathSaves.failures + (rawDie === 1 ? 2 : rawDie < 10 ? 1 : 0)
  )
  if (failures >= DEATH_SAVE_LIMIT) return { deathSaves: DEAD, regainsHitPoint: false }
  return {
    deathSaves:
      successes >= DEATH_SAVE_LIMIT
        ? { successes: 0, failures: 0, stable: true }
        : { successes, failures, stable: false },
    regainsHitPoint: false
  }
}

/**
 * The death saves a Sheet editor's marks set at 0 hit points: a third failure is death, else a
 * third success makes the Character stable (counts reset), as a rolled save would.
 */
export function deathSavesAfterMarksSet(marks: {
  successes: number
  failures: number
}): CharacterDeathSaves {
  if (marks.failures >= DEATH_SAVE_LIMIT) return DEAD
  return marks.successes >= DEATH_SAVE_LIMIT
    ? { successes: 0, failures: 0, stable: true }
    : { successes: marks.successes, failures: marks.failures, stable: false }
}

/** A target that died outright (hit point maximum reduced to 0, or a terminal scalar reduction). */
export function deathSavesAfterDeath(): CharacterDeathSaves {
  return DEAD
}

/**
 * The death saves after a Sheet hit point edit from `before` to `after` current hit points. Any
 * edit above 0 revives (the GM's, or the owner's on their Sheet); a drop is damage, a rise from 0
 * is healing.
 */
export function deathSavesAfterSheetEdit(input: {
  deathSaves: CharacterDeathSaves
  currentHitPoints: number
  nextHitPoints: number
  maximumHitPoints: number
}): CharacterDeathSaves {
  const { deathSaves, currentHitPoints, nextHitPoints, maximumHitPoints } = input
  if (nextHitPoints > 0) return NO_DEATH_SAVES
  return deathSavesAfterDamage({
    deathSaves,
    currentHitPoints,
    maximumHitPoints,
    dealt: currentHitPoints - nextHitPoints,
    critical: false
  })
}
