import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import {
  addAllOption,
  getClearButtonAriaLabel,
  resolveMultiSelectValue,
  toComboboxData
} from './selectOptions'

describe('select option helpers', () => {
  it('uses visible ReactNode label text for the clear button name', () => {
    const label = createElement('span', null, 'Spell ', createElement('strong', null, 'school'))

    expect(getClearButtonAriaLabel(label, 'Clear selected option')).toBe('Clear Spell school')
    expect(getClearButtonAriaLabel(null, 'Clear selected option')).toBe('Clear selected option')
  })

  it('normalizes flat select options for Mantine', () => {
    expect(toComboboxData([
      { value: 'wizard', label: 'Wizard' },
      { value: 'blank', label: '   ' }
    ])).toEqual([{ value: 'wizard', label: 'Wizard', disabled: undefined }])
  })

  it('normalizes grouped select options for Mantine', () => {
    expect(toComboboxData([
      {
        group: 'Spellcasters',
        items: [{ value: 'wizard', label: 'Wizard' }]
      }
    ])).toEqual([
      {
        group: 'Spellcasters',
        items: [{ value: 'wizard', label: 'Wizard', disabled: undefined }]
      }
    ])
  })

  it('adds the opt-in all shortcut without changing source options', () => {
    expect(addAllOption([{ value: 'wizard', label: 'Wizard' }])).toEqual([
      { value: 'all', label: 'All' },
      { value: 'wizard', label: 'Wizard', disabled: undefined }
    ])
  })

  it('keeps all as the only selected value when the shortcut is selected', () => {
    expect(resolveMultiSelectValue({
      currentValue: ['wizard'],
      nextValue: ['wizard', 'all']
    })).toEqual(['all'])
  })

  it('switches from all to explicit selections when a specific option is selected', () => {
    expect(resolveMultiSelectValue({
      currentValue: ['all'],
      nextValue: ['all', 'wizard']
    })).toEqual(['wizard'])
  })
})
