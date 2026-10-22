import { describe, expect, it } from 'vitest'
import type { SpellGrantAuthored } from '#authored'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  SCALING,
  SPELL_GRANT_ACCESS
} from '#core'
import { compileSpellGrant, compileSpellGrantResult } from '#compilers'

/** SPELLS-31.T5p (D175): a spell grant's slot pool and the class lists it joins. */

const listOnly: SpellGrantAuthored = {
  grantKind: GRANT_KIND.SPELL_GRANT,
  id: 'expanded',
  order: 0,
  selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
  scalingKind: SCALING.NONE,
  authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
  spellIds: ['fireball'],
  access: SPELL_GRANT_ACCESS.CLASS_LIST_ONLY,
  classListIds: ['warlock']
}

const refusal = (authored: SpellGrantAuthored) => {
  const result = compileSpellGrantResult(authored)
  return result.ok ? null : result.diagnostics[0]?.code
}

describe('spell grant class lists and slot pools', () => {
  it('compiles a class-list-only grant carrying its lists', () => {
    expect(compileSpellGrant(listOnly)).toMatchObject({
      access: SPELL_GRANT_ACCESS.CLASS_LIST_ONLY,
      classListIds: ['warlock'],
      spellIds: ['fireball']
    })
  })

  it('compiles a pool-paid grant carrying its pool code', () => {
    const compiled = compileSpellGrant({
      grantKind: GRANT_KIND.SPELL_GRANT,
      id: 'pact',
      order: 0,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      spellIds: ['bane'],
      slotCost: { poolCode: 'PACT' }
    })
    expect(compiled.slotCost).toEqual({ poolCode: 'PACT' })
  })

  it.each([
    [
      'without the lists it joins',
      { ...listOnly, classListIds: undefined },
      'SPELL_GRANT_CLASS_LIST_MISSING'
    ],
    ['with an empty list', { ...listOnly, classListIds: [] }, 'SPELL_GRANT_CLASS_LIST_MISSING'],
    [
      'naming lists though it is not list-only',
      { ...listOnly, access: undefined },
      'SPELL_GRANT_CLASS_LIST_UNUSED'
    ],
    [
      'naming no spells',
      { ...listOnly, authoringModeKind: AUTHORING_MODE_KIND.ALL },
      'SPELL_GRANT_CLASS_LIST_SHAPE'
    ]
  ] as [string, SpellGrantAuthored, string][])(
    'refuses a class-list-only grant %s',
    (_name, authored, code) => {
      expect(refusal(authored)).toBe(code)
    }
  )
})
