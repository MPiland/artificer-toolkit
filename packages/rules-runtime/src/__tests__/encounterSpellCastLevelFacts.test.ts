import { describe, expect, it } from 'vitest'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'

import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import {
  DND5E_SPELL_CAST_LEVEL_FACT_KEY,
  dnd5eCharacterRuleActionSystemAdapter as adapter
} from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { fixedHealSpell } from '../testing/fixedHealSpell.js'

const FIREBALL = srdSpells.find((spell) => spell.label === 'Fireball')!
const FIRE_BOLT = srdSpells.find((spell) => spell.label === 'Fire Bolt')!
const MEND = fixedHealSpell()

const spellAction = (spell: SpellAuthored) => {
  const effect = spell.effects?.[0]
  if (!effect) throw new Error(`${spell.label} has no effect`)
  const action = characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID }))
  return { action, compilerSource: buildCompiledActionCompilerSource(action) }
}

const TARGET_ID = '00000000-0000-4000-8000-0000000c0001'

/** The binding a Creature target gets: no attack, no save, so the facts are the base facts. */
function bind(spell: SpellAuthored, actionMechanic: Record<string, unknown>) {
  const { action, compilerSource } = spellAction(spell)
  // A spell with an attack or save is bound at its TEST phase; one without (a heal) as a single graph.
  const test =
    spell === FIREBALL || spell === FIRE_BOLT
      ? adapter.compileTestTemplate?.({ compilerSource })
      : null
  const published = test ? test.published : adapter.compile({ action })
  return adapter.bindFacts({
    actionMechanic,
    published,
    sourceDerivedFacts: {},
    targetActorId: TARGET_ID,
    targetDerivedFacts: {},
    targetConditionIds: [],
    currentHitPoints: 20,
    temporaryHitPoints: 0,
    maximumHitPoints: 20,
    targetScalarValues: {},
    defenses: []
  }).facts
}

describe('the spell cast level the action binds (M2)', () => {
  it.each([
    ['a damage spell', FIREBALL],
    ['a non-damage spell', MEND]
  ])('binds the cast level of %s as a fact', (_name, spell) => {
    expect(bind(spell, { outcomes: [], spellCastLevel: 5 })[DND5E_SPELL_CAST_LEVEL_FACT_KEY]).toBe(
      5
    )
  })

  it('binds the Character level, the sum of its class levels, for a level-scaled cantrip', () => {
    expect(bind(FIRE_BOLT, { outcomes: [], classLevels: { fighter: 3, wizard: 2 } })).toMatchObject(
      {
        characterLevel: 5
      }
    )
    expect(bind(FIRE_BOLT, { outcomes: [] })).not.toHaveProperty('characterLevel')
  })

  it('binds no cast level for an action that is not a leveled cast', () => {
    expect(bind(FIREBALL, { outcomes: [] })).not.toHaveProperty(DND5E_SPELL_CAST_LEVEL_FACT_KEY)
  })
})

describe('scaling a spell by the cast level fact (M2)', () => {
  const specialize = (castLevel: number) => {
    const { compilerSource } = spellAction(FIREBALL)
    const testTemplate = adapter.compileTestTemplate?.({ compilerSource })
    if (!testTemplate) throw new Error('Fireball has no TEST template.')
    return adapter.specializeOutcomeTemplate?.({
      compilerSource,
      testTemplate,
      selectedPath: 'ON_SAVE_FAIL',
      facts: { [DND5E_SPELL_CAST_LEVEL_FACT_KEY]: castLevel }
    })
  }

  it('selects a different damage outcome per cast level, from the fact alone', () => {
    const checksums = [3, 4, 9].map((level) => specialize(level)?.published.checksum)
    expect(checksums.every((checksum) => typeof checksum === 'string')).toBe(true)
    expect(new Set(checksums).size).toBe(3)
  })

  it('selects the same outcome for the same cast level', () => {
    expect(specialize(5)?.published.checksum).toBe(specialize(5)?.published.checksum)
  })
})

describe('scaling a cantrip by the Character level fact', () => {
  const specialize = (facts: Record<string, number>) => {
    const { compilerSource } = spellAction(FIRE_BOLT)
    const testTemplate = adapter.compileTestTemplate?.({ compilerSource })
    if (!testTemplate) throw new Error('Fire Bolt has no TEST template.')
    return adapter.specializeOutcomeTemplate?.({
      compilerSource,
      testTemplate,
      selectedPath: 'ON_HIT',
      facts
    })
  }

  it('selects the damage row of the Character level', () => {
    const [first, fifth, eleventh] = [1, 5, 11].map(
      (characterLevel) => specialize({ characterLevel })?.published.checksum
    )
    expect(new Set([first, fifth, eleventh]).size).toBe(3)
  })

  it('refuses a Character level it was not given', () => {
    expect(() => specialize({})).toThrow('D&D dice scaling facts are unavailable.')
  })
})
