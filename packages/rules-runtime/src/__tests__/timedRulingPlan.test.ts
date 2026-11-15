import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { arcaneLock } from '@artificer-toolkit/source-data/srd/spells/arcane-lock.js'
import { geas } from '@artificer-toolkit/source-data/srd/spells/geas.js'
import { light } from '@artificer-toolkit/source-data/srd/spells/light.js'
import { suggestion } from '@artificer-toolkit/source-data/srd/spells/suggestion.js'
import { describe, expect, it } from 'vitest'

import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '../systems/dnd5e/concentrationIdentity.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { compiledTestSpellCast, plannedCastEffects } from '../testing/plannedTimedCondition.js'

const SOURCE_ID = testUuid(0xd701)
const HOLDER_ID = testUuid(0xd702)
const LIFETIME_REFUSAL =
  'D&D Effect action must have one fixed direct result without lifecycle overrides. Its duration, lifecycle or maintenance has no plan that holds it.'

/** The spell cast from a class slot at its own level, through the real cast and entry compilers. */
function castOf(spell: SpellAuthored) {
  const sourceInstanceId = `class-${spell.id}`
  return compiledTestSpellCast({
    spell,
    cast: {
      sequence: 0,
      candidateId: `CLASS:${sourceInstanceId}:${spell.id}:level:${spell.level}`,
      spellId: spell.id,
      source: { spellId: spell.id, sourceKind: 'CLASS', sourceInstanceId },
      spellLevel: spell.level,
      castMode: 'SPELL_SLOT',
      castLevel: spell.level,
      baseEntry: true,
      resourceOwnerKey: null,
      slotPoolCode: null
    },
    decision: {
      status: 'AVAILABLE',
      reasonCode: 'SPELL_SLOT_REMAINING',
      slotKey: `STANDARD:${spell.level}`
    }
  }).entry
}

/** The effects the room plans when `spell` lands on the holder along `resultPath`. */
function landed(spell: SpellAuthored, resultPath: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS') {
  return plannedCastEffects({
    encounterId: testUuid(0xd700),
    sourceActorId: SOURCE_ID,
    holderActorId: HOLDER_ID,
    spell,
    entry: castOf(spell),
    lifetimeScope: 'ENCOUNTER',
    resultPath
  })
}

/** The spell's one Effect as a Character action, compiled straight through the System adapter. */
function compileDirect(spell: SpellAuthored) {
  const [effect] =
    compileSpell({
      ...spell,
      effects: (spell.effects ?? []).map((authored) => ({ ...authored, id: ACTION_EFFECT_ID }))
    }).effects ?? []
  if (!effect) throw new Error(`${spell.label} authors no Effect.`)
  return () =>
    dnd5eCharacterRuleActionSystemAdapter.compile({ action: characterActionDescriptor(effect) })
}

/** The GM ruling `effect` holds, by its stored state contributions. */
const rulingOf = (effect: ReturnType<typeof landed>['recurringEffect']) =>
  effect?.definition.stateContributions.filter(({ kind }) => kind === 'GM_RULING')

describe('a GM ruling with a duration is held as a timed ruling (QUALITY-15.T3)', () => {
  it('holds a failed Suggestion for 8 hours under Concentration, carrying the ruling text', () => {
    const { activeEffectPlan } = castOf(suggestion).compilation
    expect(activeEffectPlan).toMatchObject({
      recurrenceStage: 'END_OF_TURN',
      // 8 hours of 6-second turns.
      initialRemaining: 4800,
      resultGate: { paths: ['ON_SAVE_FAIL'] },
      maintenance: { definitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID }
    })
    const { recurringEffect } = landed(suggestion, 'ON_SAVE_FAIL')
    expect(rulingOf(recurringEffect)).toEqual([
      {
        kind: 'GM_RULING',
        rulingOutcomeId: expect.any(String),
        label: 'Judge the Suggested Course',
        instructions:
          'The suggestion must be worded in such a manner as to make the course of action sound reasonable.'
      }
    ])
    expect(recurringEffect?.lifecycle.remainingTicks).toBe(4800)
  })

  it('leaves nothing behind when the target makes its save against Suggestion', () => {
    expect(landed(suggestion, 'ON_SAVE_SUCCESS').recurringEffect).toBeNull()
  })

  it('holds an Arcane Lock until dispelled: never ticked, never expiring, no Concentration', () => {
    const { activeEffectPlan } = castOf(arcaneLock).compilation
    expect(activeEffectPlan).toMatchObject({
      recurrenceStage: 'NONE',
      initialRemaining: null,
      maintenance: null
    })
    const { recurringEffect } = landed(arcaneLock, 'ON_SAVE_FAIL')
    expect(rulingOf(recurringEffect)).toHaveLength(1)
    expect(recurringEffect?.lifecycle.remainingTicks).toBeNull()
  })

  it('still refuses a ruling longer than an active effect can last, or beside another result', () => {
    // Geas lasts 30 days, past the longest duration an active effect holds.
    expect(compileDirect(geas)).toThrow(LIFETIME_REFUSAL)
    // Light's ruling sits beside the light it sheds, which no timed ruling holds.
    expect(compileDirect(light)).toThrow(LIFETIME_REFUSAL)
  })
})
