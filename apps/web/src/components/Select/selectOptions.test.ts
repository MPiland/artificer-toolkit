import { describe, expect, it } from 'vitest'
import { addAllOption, resolveMultiSelectValue, toComboboxData } from './selectOptions'

describe('select option helpers', () => {
  it('normalizes flat select options for Mantine', () => {
    expect(toComboboxData([
      { value: 'wizard', label: 'Wizard' },
      { value: 'blank', label: '   ' }
    ])).toEqual([
      { value: 'wizard', label: 'Wizard', disabled: undefined }
    ])
  })

  it('normalizes grouped select options for Mantine', () => {
    expect(toComboboxData([
      {
        group: 'Spellcasters',
        items: [
          { value: 'wizard', label: 'Wizard' }
        ]
      }
    ])).toEqual([
      {
        group: 'Spellcasters',
        items: [
          { value: 'wizard', label: 'Wizard', disabled: undefined }
        ]
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
