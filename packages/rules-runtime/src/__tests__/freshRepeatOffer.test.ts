import { describe, expect, it } from 'vitest'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import { buildCompiledActionTargetPolicy } from '../encounterActionEntryPointCompiler.js'
import { evaluateEncounterActionTargetPolicy } from '../encounterActionTargetPolicy.js'

import { FRESH_REPEAT_EFFECT_ID, freshRepeatSpell } from '../testing/freshRepeatSpell.js'
import { compiledTestSpellCast } from '../testing/plannedTimedCondition.js'

/**
 * SPELLS-4.T2lb2b1 (D186): a repeat offer can pick a fresh creature each turn. It rides a source-held
 * carrier that lives as long as the Concentration, and a creature that saved is excluded by a
 * Concentration-lifetime immunity. Everything is authored from core options.
 */

const FEET_GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}

const tokenAt = (column: number) => ({
  position: { x: column * 100 + 50, y: 50 },
  width: 100,
  height: 100,
  rotationDegrees: 0
})

/** The warnings a fresh pick `column` squares away draws, held to the range the cast's frozen invocation names. */
function pickWarnings(range: Parameters<typeof freshRepeatSpell>[0], column: number) {
  const effect = freshRepeatSpell(range).effects?.[0]
  if (!effect) throw new Error('The spell has an effect.')
  const targetPolicy = buildCompiledActionTargetPolicy({
    compiledEffect: compileEffect(effect)
  } as Parameters<typeof buildCompiledActionTargetPolicy>[0])
  return evaluateEncounterActionTargetPolicy({
    actor: { id: 'caster', disposition: 'FRIENDLY' },
    target: { id: 'pick', disposition: 'HOSTILE' },
    targetPolicy,
    sceneContext: { grid: FEET_GRID, sourceToken: tokenAt(0), targetToken: tokenAt(column) },
    makesAttackRoll: false
  })
}

function compileCast(spell: SpellAuthored) {
  return compiledTestSpellCast({
    spell,
    cast: {
      sequence: 0,
      candidateId: `CLASS:test:${spell.id}:level:6`,
      spellId: spell.id,
      source: { spellId: spell.id, sourceKind: 'CLASS', sourceInstanceId: 'test' },
      spellLevel: 6,
      castMode: 'SPELL_SLOT',
      castLevel: 6,
      baseEntry: true,
      resourceOwnerKey: null,
      slotPoolCode: null
    },
    decision: { status: 'AVAILABLE', reasonCode: 'SPELL_SLOT_REMAINING', slotKey: 'STANDARD:6' }
  })
}

describe('a fresh repeat offer (SPELLS-4.T2lb2b1)', () => {
  it('compiles a source-held carrier and an immunity that lasts as long as the Concentration', () => {
    const plan = compileCast(freshRepeatSpell()).entry.compilation.activeEffectPlan
    expect(plan?.repeatCarrier).toMatchObject({
      heldBy: 'SOURCE',
      effectOffers: [{ kind: 'REPEAT_SOURCE_PATH', target: 'FRESH', activation: 'ACTION' }]
    })
    expect(plan?.sourceImmunity).toMatchObject({
      appliesTo: 'SAVE_SUCCESS',
      immuneToId: FRESH_REPEAT_EFFECT_ID,
      underConcentration: true
    })
    expect(plan?.maintenance).toBeTruthy()
  })

  it('also compiles for a touch-range invocation, so Break Enchantment can reuse the path', () => {
    expect(
      compileCast(freshRepeatSpell('TOUCH')).entry.compilation.activeEffectPlan?.repeatCarrier
    ).toMatchObject({ heldBy: 'SOURCE' })
  })

  it('refuses a save immunity under Concentration that does not say so', () => {
    const spell = freshRepeatSpell()
    const immunity = spell.effects
      ?.flatMap((effect) => effect.paths ?? [])
      .flatMap((path) => ('resultBlock' in path ? path.resultBlock.outcomes : []))
      .find((outcome) => outcome.effectKind === 'SOURCE_IMMUNITY')
    if (immunity?.effectKind !== 'SOURCE_IMMUNITY') throw new Error('The spell grants an immunity.')
    expect(() => compileCast(freshRepeatSpell())).not.toThrow()
    delete immunity.lifetime
    expect(() => compileCast(spell)).toThrow()
  })

  it('refuses a fresh carrier on an area invocation', () => {
    const spell = freshRepeatSpell()
    const effect = spell.effects?.[0]
    if (!effect) throw new Error('The spell has an effect.')
    expect(() => compileCast(freshRepeatSpell())).not.toThrow()
    effect.invocation = {
      ...effect.invocation,
      targeting: { selectionKind: 'CHOSEN_CREATURES', dispositionKind: 'ANY', maxTargets: 2 }
    }
    expect(() => compileCast(spell)).toThrow()
  })

  it('holds a fresh pick to the range the frozen invocation names, and a touch invocation to touch', () => {
    expect(pickWarnings({ amount: 60 }, 12)).toEqual([])
    expect(pickWarnings({ amount: 60 }, 13)).toEqual([
      { code: 'TARGET_OUT_OF_RANGE', message: 'The target is out of range.' }
    ])
    expect(pickWarnings('TOUCH', 1)).toEqual([])
    expect(pickWarnings('TOUCH', 2)).toEqual([
      { code: 'TARGET_OUT_OF_RANGE', message: 'The target is out of range.' }
    ])
  })
})
