import { describe, expect, it } from 'vitest'
import {
  DEATH_SAVE_LIMIT,
  deathSavesAfterDamage,
  deathSavesAfterDeath,
  deathSavesAfterHealing,
  deathSavesAfterRevive,
  deathSavesAfterRoll,
  deathSavesAfterSheetEdit,
  deathSavesAfterStabilize,
  isCharacterDead,
  isCharacterDying,
  isTargetDead
} from '../shared/characterDeathSaves.js'
import { NO_DEATH_SAVES } from '../subjects/characterState.js'

const dying = { successes: 1, failures: 1, stable: false }
const stable = { successes: 3, failures: 0, stable: true }
const dead = { successes: 0, failures: DEATH_SAVE_LIMIT, stable: false }

describe('Character death saves (D96)', () => {
  it('is dead at three failures only', () => {
    expect(isCharacterDead(NO_DEATH_SAVES)).toBe(false)
    expect(isCharacterDead({ successes: 2, failures: 2, stable: false })).toBe(false)
    expect(isCharacterDead(dead)).toBe(true)
  })

  describe('damage', () => {
    it('leaves a Character dropped to 0 dying', () => {
      expect(
        deathSavesAfterDamage({
          deathSaves: NO_DEATH_SAVES,
          currentHitPoints: 4,
          maximumHitPoints: 10,
          dealt: 9,
          critical: false
        })
      ).toEqual(NO_DEATH_SAVES)
    })

    it('kills outright when the overflow past 0 reaches the maximum (massive damage)', () => {
      const input = { deathSaves: NO_DEATH_SAVES, currentHitPoints: 4, maximumHitPoints: 10 }
      expect(deathSavesAfterDamage({ ...input, dealt: 14, critical: false })).toEqual(dead)
      expect(deathSavesAfterDamage({ ...input, dealt: 20, critical: false })).toEqual(dead)
    })

    it('does not kill when the overflow is one short of the maximum', () => {
      expect(
        deathSavesAfterDamage({
          deathSaves: NO_DEATH_SAVES,
          currentHitPoints: 4,
          maximumHitPoints: 10,
          dealt: 13,
          critical: false
        })
      ).toEqual(NO_DEATH_SAVES)
    })

    it('adds one failure for damage at 0, two for a critical hit, and ends stability', () => {
      const atZero = { currentHitPoints: 0, maximumHitPoints: 10, dealt: 3 }
      expect(deathSavesAfterDamage({ ...atZero, deathSaves: dying, critical: false })).toEqual({
        successes: 1,
        failures: 2,
        stable: false
      })
      expect(deathSavesAfterDamage({ ...atZero, deathSaves: dying, critical: true })).toEqual({
        successes: 1,
        failures: DEATH_SAVE_LIMIT,
        stable: false
      })
      expect(deathSavesAfterDamage({ ...atZero, deathSaves: stable, critical: false })).toEqual({
        successes: 3,
        failures: 1,
        stable: false
      })
    })

    it('kills at 0 when the damage is at least the maximum', () => {
      expect(
        deathSavesAfterDamage({
          deathSaves: NO_DEATH_SAVES,
          currentHitPoints: 0,
          maximumHitPoints: 10,
          dealt: 10,
          critical: false
        })
      ).toEqual(dead)
    })

    it('ignores damage that dealt nothing and damage to the dead', () => {
      expect(
        deathSavesAfterDamage({
          deathSaves: dying,
          currentHitPoints: 0,
          maximumHitPoints: 10,
          dealt: 0,
          critical: true
        })
      ).toBe(dying)
      expect(
        deathSavesAfterDamage({
          deathSaves: dead,
          currentHitPoints: 0,
          maximumHitPoints: 10,
          dealt: 3,
          critical: false
        })
      ).toBe(dead)
    })
  })

  describe('healing', () => {
    it('resets the saves when any hit points are regained', () => {
      expect(deathSavesAfterHealing({ deathSaves: dying, appliedAmount: 1 })).toEqual(
        NO_DEATH_SAVES
      )
    })

    it('leaves the saves when nothing was regained and ignores healing for the dead', () => {
      expect(deathSavesAfterHealing({ deathSaves: dying, appliedAmount: 0 })).toBe(dying)
      expect(deathSavesAfterHealing({ deathSaves: dead, appliedAmount: 5 })).toBe(dead)
    })
  })

  describe('a death save roll', () => {
    it('adds two failures on a 1 and one failure on 2 to 9', () => {
      expect(deathSavesAfterRoll(NO_DEATH_SAVES, 1)).toEqual({
        deathSaves: { successes: 0, failures: 2, stable: false },
        regainsHitPoint: false
      })
      expect(deathSavesAfterRoll(NO_DEATH_SAVES, 9)).toEqual({
        deathSaves: { successes: 0, failures: 1, stable: false },
        regainsHitPoint: false
      })
    })

    it('adds a success on 10 to 19', () => {
      expect(deathSavesAfterRoll(NO_DEATH_SAVES, 10).deathSaves).toEqual({
        successes: 1,
        failures: 0,
        stable: false
      })
      expect(deathSavesAfterRoll(dying, 19)).toEqual({
        deathSaves: { successes: 2, failures: 1, stable: false },
        regainsHitPoint: false
      })
    })

    it('regains 1 hit point and resets the saves on a 20', () => {
      expect(deathSavesAfterRoll(dying, 20)).toEqual({
        deathSaves: NO_DEATH_SAVES,
        regainsHitPoint: true
      })
    })

    it('totals the added dice (D156) with the die, keeping the natural 1 and 20 rules', () => {
      // Bless lifts a 9 to a success; Bane drops a 10 to a failure.
      expect(deathSavesAfterRoll(NO_DEATH_SAVES, 9, 1).deathSaves).toEqual({
        successes: 1,
        failures: 0,
        stable: false
      })
      expect(deathSavesAfterRoll(NO_DEATH_SAVES, 10, -3).deathSaves).toEqual({
        successes: 0,
        failures: 1,
        stable: false
      })
      // A natural 1 is still two failures, and only a natural 20 regains a hit point.
      expect(deathSavesAfterRoll(NO_DEATH_SAVES, 1, 4).deathSaves).toEqual({
        successes: 0,
        failures: 2,
        stable: false
      })
      expect(deathSavesAfterRoll(dying, 20, -4)).toEqual({
        deathSaves: NO_DEATH_SAVES,
        regainsHitPoint: true
      })
      expect(deathSavesAfterRoll(dying, 19, 4)).toEqual({
        deathSaves: { successes: 2, failures: 1, stable: false },
        regainsHitPoint: false
      })
    })

    it('stabilizes on the third success with the counts reset', () => {
      expect(deathSavesAfterRoll({ successes: 2, failures: 2, stable: false }, 12)).toEqual({
        deathSaves: { successes: 0, failures: 0, stable: true },
        regainsHitPoint: false
      })
    })

    it('is dead on the third failure, including a 1 with two failures already', () => {
      expect(deathSavesAfterRoll({ successes: 2, failures: 2, stable: false }, 5)).toEqual({
        deathSaves: dead,
        regainsHitPoint: false
      })
      expect(
        deathSavesAfterRoll({ successes: 0, failures: 2, stable: false }, 1).deathSaves
      ).toEqual(dead)
    })
  })

  it('reports a Character that died outright', () => {
    expect(deathSavesAfterDeath()).toEqual(dead)
  })

  describe('a Sheet hit point edit', () => {
    const edit = { currentHitPoints: 0, maximumHitPoints: 10 }

    it('revives a dead Character with any edit above 0', () => {
      expect(deathSavesAfterSheetEdit({ ...edit, deathSaves: dead, nextHitPoints: 1 })).toEqual(
        NO_DEATH_SAVES
      )
    })

    it('treats a drop as damage that is not critical', () => {
      expect(
        deathSavesAfterSheetEdit({
          deathSaves: NO_DEATH_SAVES,
          currentHitPoints: 3,
          maximumHitPoints: 10,
          nextHitPoints: 0
        })
      ).toEqual(NO_DEATH_SAVES)
    })

    it('leaves a dying Character at 0 unchanged', () => {
      expect(deathSavesAfterSheetEdit({ ...edit, deathSaves: dying, nextHitPoints: 0 })).toBe(dying)
    })
  })

  describe('stabilizing', () => {
    it('is dying only at 0 hit points, not stable and not dead', () => {
      expect(isCharacterDying(NO_DEATH_SAVES, 0)).toBe(true)
      expect(isCharacterDying(dying, 0)).toBe(true)
      expect(isCharacterDying(NO_DEATH_SAVES, 1)).toBe(false)
      expect(isCharacterDying(stable, 0)).toBe(false)
      expect(isCharacterDying(dead, 0)).toBe(false)
    })

    it('makes a dying Character stable with the counts reset', () => {
      expect(deathSavesAfterStabilize({ deathSaves: dying, currentHitPoints: 0 })).toEqual({
        successes: 0,
        failures: 0,
        stable: true
      })
    })

    it('changes nothing for a Character that is not dying', () => {
      expect(deathSavesAfterStabilize({ deathSaves: dying, currentHitPoints: 3 })).toBe(dying)
      expect(deathSavesAfterStabilize({ deathSaves: stable, currentHitPoints: 0 })).toBe(stable)
      expect(deathSavesAfterStabilize({ deathSaves: dead, currentHitPoints: 0 })).toBe(dead)
    })

    it('is undone by damage at 0, which adds a failure and ends stability', () => {
      const stabilized = deathSavesAfterStabilize({ deathSaves: dying, currentHitPoints: 0 })
      expect(
        deathSavesAfterDamage({
          deathSaves: stabilized,
          currentHitPoints: 0,
          maximumHitPoints: 10,
          dealt: 3,
          critical: false
        })
      ).toEqual({ successes: 0, failures: 1, stable: false })
    })
  })
})

describe('Revival (SPELLS-4.T2g1)', () => {
  it('clears every death save, even a dead Character', () => {
    expect(deathSavesAfterRevive()).toEqual(NO_DEATH_SAVES)
  })

  it('reads a target as dead at 0 hit points with three failures, or with no death saves at all', () => {
    expect(isTargetDead({ currentHitPoints: 0, deathSaves: dead })).toBe(true)
    expect(isTargetDead({ currentHitPoints: 0, deathSaves: null })).toBe(true)
    expect(isTargetDead({ currentHitPoints: 0, deathSaves: dying })).toBe(false)
    expect(isTargetDead({ currentHitPoints: 0, deathSaves: stable })).toBe(false)
    expect(isTargetDead({ currentHitPoints: 4, deathSaves: null })).toBe(false)
  })
})
