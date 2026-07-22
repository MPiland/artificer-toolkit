import { describe, expect, it } from 'vitest'
import {
  getAuthoringStepHref,
  isAuthoringStepNavigationState,
  isAuthoringStepOnlyNavigation,
  markAuthoringStepNavigationState,
  readAuthoringStep
} from './authoringSearch'

describe('authoring search', () => {
  it('preserves unrelated search parameters and the hash in step links', () => {
    expect(getAuthoringStepHref('/characters/new?source=owned#builder', 'RACE')).toBe(
      '/characters/new?source=owned&step=RACE#builder'
    )
  })

  it('reads only non-empty step values', () => {
    expect(readAuthoringStep({ step: 'RACE' })).toBe('RACE')
    expect(readAuthoringStep({ step: '' })).toBeUndefined()
    expect(readAuthoringStep({ step: 1 })).toBeUndefined()
  })

  it('marks only authoring-step history entries while preserving router state', () => {
    const state = markAuthoringStepNavigationState({ __TSR_index: 2, source: 'test' })

    expect(state).toEqual({
      __TSR_index: 2,
      source: 'test',
      __authoringStepNavigation: true
    })
    expect(isAuthoringStepNavigationState(state)).toBe(true)
    expect(isAuthoringStepNavigationState({ __TSR_index: 2 })).toBe(false)
  })

  it('identifies only same-record navigation where step is the sole change', () => {
    expect(
      isAuthoringStepOnlyNavigation(
        { pathname: '/characters/new', search: { source: 'owned', step: 'BASICS' } },
        { pathname: '/characters/new', search: { source: 'owned', step: 'RACE' } }
      )
    ).toBe(true)
    expect(
      isAuthoringStepOnlyNavigation(
        { pathname: '/characters/new', search: { source: 'owned', step: 'BASICS' } },
        { pathname: '/characters/new', search: { source: 'all', step: 'RACE' } }
      )
    ).toBe(false)
    expect(
      isAuthoringStepOnlyNavigation(
        { pathname: '/characters/new', search: { step: 'BASICS' } },
        { pathname: '/characters/other', search: { step: 'RACE' } }
      )
    ).toBe(false)
  })
})
