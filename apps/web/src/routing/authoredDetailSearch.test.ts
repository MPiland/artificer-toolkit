import { describe, expect, it } from 'vitest'
import {
  authoredDetailSearchFor,
  resolveAuthoredDetailView,
  validateAuthoredDetailSearch
} from './authoredDetailSearch'

describe('authoredDetailSearch', () => {
  it('normalizes detail search values', () => {
    expect(validateAuthoredDetailSearch({ view: 'draft' })).toEqual({ view: 'draft' })
    expect(validateAuthoredDetailSearch({ view: 'active' })).toEqual({})
    expect(authoredDetailSearchFor('draft')).toEqual({ view: 'draft' })
    expect(authoredDetailSearchFor('active')).toEqual({})
  })

  it('loads edit routes draft-first so draft-only duplicates can open in forms', () => {
    expect(resolveAuthoredDetailView({}, '/races/7md25/dragonborn-copy/edit')).toBe('draft')
    expect(resolveAuthoredDetailView({}, '/races/7md25/dragonborn-copy/edit/')).toBe('draft')
    expect(resolveAuthoredDetailView({ view: 'active' }, '/spells/abc/acid-arrow/edit')).toBe(
      'draft'
    )
    expect(resolveAuthoredDetailView({}, '/races/7md25/dragonborn-copy')).toBe('active')
    expect(resolveAuthoredDetailView({ view: 'draft' }, '/races/7md25/dragonborn-copy')).toBe(
      'draft'
    )
  })
})
