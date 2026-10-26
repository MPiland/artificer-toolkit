import type { z } from '../zod.js'
import { NO_DEATH_SAVES, type characterDeathSavesDtoSchema } from '../subjects/characterState.js'

/**
 * The pure dying and death rules (D96, SRD 5.1). Every writer of Character hit points uses these:
 * the Encounter mechanics fold, its receipt replay, the Sheet reducer and Undo. Dying is 0 hit
 * points, not stable and under three failures; dead is three failures, so no separate flag exists.
 */
export type CharacterDeathSaves = z.infer<typeof characterDeathSavesDtoSchema>

export const DEATH_SAVE_LIMIT = 3

const DEATH_SAVE_DIFFICULTY_CLASS = 10

const DEAD: CharacterDeathSaves = { successes: 0, failures: DEATH_SAVE_LIMIT, stable: false }

export function isCharacterDead(deathSaves: CharacterDeathSaves): boolean {
  return deathSaves.failures >= DEATH_SAVE_LIMIT
}

/**
 * Dead: a Character with three failed death saves at 0 hit points, or any other target (death saves
 * null) at 0 hit points. The one condition a revive acts on.
 */
export function isTargetDead(target: {
  currentHitPoints: number
  deathSaves: CharacterDeathSaves | null
}): boolean {
  return (
    target.currentHitPoints === 0 &&
    (target.deathSaves === null || isCharacterDead(target.deathSaves))
  )
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

/** A revived Character starts over: the death saves clear, whatever count the death left. */
export function deathSavesAfterRevive(): CharacterDeathSaves {
  return NO_DEATH_SAVES
}

/** The hit points a revive restores: a fixed number or the target's maximum. */
export type ReviveHitPoints = { kind: 'FIXED'; amount: number } | { kind: 'MAXIMUM' }

/** The current hit points a revived target wakes with; a fixed number never exceeds its maximum. */
export function reviveRestoredHitPoints(hitPoints: ReviveHitPoints, maximum: number): number {
  return hitPoints.kind === 'FIXED' ? Math.min(hitPoints.amount, maximum) : maximum
}

/** A revive's hit points as the rule operation's scalar ports (a maximum carries amount 0). */
export function reviveHitPointsPorts(hitPoints: ReviveHitPoints): {
  hitPointsKind: ReviveHitPoints['kind']
  hitPointsAmount: number
} {
  return {
    hitPointsKind: hitPoints.kind,
    hitPointsAmount: hitPoints.kind === 'FIXED' ? hitPoints.amount : 0
  }
}

/** True when a revive trace's scalar ports carry the receipt's hit points. */
export function reviveTraceMatches(
  outputs: Record<string, unknown>,
  hitPoints: ReviveHitPoints
): boolean {
  const ports = reviveHitPointsPorts(hitPoints)
  return (
    outputs.hitPointsKind === ports.hitPointsKind &&
    outputs.hitPointsAmount === ports.hitPointsAmount
  )
}

/**
 * How far a death save roll fell short of its DC, by the same rule as `deathSavesAfterRoll`; null
 * when it succeeded. A natural 1 fails whatever its total.
 */
export function deathSaveShortfall(rawDie: number, addedTotal = 0): number | null {
  if (rawDie === 20) return null
  const shortfall = DEATH_SAVE_DIFFICULTY_CLASS - (rawDie + addedTotal)
  return rawDie === 1 || shortfall > 0 ? shortfall : null
}

/**
 * The death saves after a dying Character's death save roll (a d20 with no modifier, plus any added
 * dice). A natural 20 regains 1 hit point, which resets the saves, and a natural 1 is two failures;
 * otherwise a total of 10 or more is a success and less a failure. A third success makes the Character stable (counts reset) and a third failure dead.
 */
export function deathSavesAfterRoll(
  deathSaves: CharacterDeathSaves,
  rawDie: number,
  /** The signed total of the save's added dice (D156): a 1 and a 20 stay natural. */
  addedTotal = 0
): { deathSaves: CharacterDeathSaves; regainsHitPoint: boolean } {
  if (rawDie === 20) return { deathSaves: NO_DEATH_SAVES, regainsHitPoint: true }
  const succeeded = rawDie + addedTotal >= DEATH_SAVE_DIFFICULTY_CLASS
  const successes = deathSaves.successes + (rawDie !== 1 && succeeded ? 1 : 0)
  const failures = Math.min(
    DEATH_SAVE_LIMIT,
    deathSaves.failures + (rawDie === 1 ? 2 : succeeded ? 0 : 1)
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
