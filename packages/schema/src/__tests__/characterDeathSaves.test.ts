import { describe, expect, it } from 'vitest'
import {
  DEATH_SAVE_LIMIT,
  deathSavesAfterDamage,
  deathSavesAfterDeath,
  deathSavesAfterHealing,
  deathSavesAfterSheetEdit,
  isCharacterDead
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
})
