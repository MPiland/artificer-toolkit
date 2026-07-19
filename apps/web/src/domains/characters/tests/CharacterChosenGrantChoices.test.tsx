import { screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { CharacterBuilderChosenGrantChoiceViewDto } from '@artificer-toolkit/schema/api/characters'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import type { CharacterFormValues } from '../characterBuilder.utils'
import { CharacterChosenGrantChoices } from '../steps/CharacterChosenGrantChoices'

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined
})

describe('CharacterChosenGrantChoices', () => {
  it('renders one select per required slot and filters other UNIQUE selections', async () => {
    const user = userEvent.setup()

    renderChosenGrantChoices(createChoice('UNIQUE'))

    const slots = screen.getAllByRole('combobox', { name: /skill proficiencies/i })
    expect(slots).toHaveLength(2)

    await user.click(slots[0])

    expect((await screen.findAllByRole('option', { hidden: true, name: 'Arcana' }))).toHaveLength(1)
    expect(screen.getAllByRole('option', { hidden: true, name: 'Perception' })).toHaveLength(2)
    expect(screen.getAllByRole('option', { hidden: true, name: 'Athletics' })).toHaveLength(1)
  })

  it('keeps selected values available in every REPEATABLE slot', async () => {
    const user = userEvent.setup()

    renderChosenGrantChoices(createChoice('REPEATABLE'))

    await user.click(screen.getAllByRole('combobox', { name: /skill proficiencies/i })[0])

    expect((await screen.findAllByRole('option', { hidden: true, name: 'Arcana' }))).toHaveLength(2)
    expect(screen.getAllByRole('option', { hidden: true, name: 'Athletics' })).toHaveLength(2)
    expect(screen.getAllByRole('option', { hidden: true, name: 'Perception' })).toHaveLength(2)
  })
})

function renderChosenGrantChoices(choice: CharacterBuilderChosenGrantChoiceViewDto) {
  const initialSelections: NonNullable<CharacterFormValues['intent']['chosenGrantSelections']> = [
    {
      id: 'selection-skills',
      grantId: choice.grantId,
      source: choice.source,
      timing: choice.timing,
      targetIds: ['skill-arcana', 'skill-athletics']
    }
  ]

  function Harness() {
    const [selections, setSelections] = useState<CharacterFormValues['intent']['chosenGrantSelections']>(initialSelections)

    return (
      <CharacterChosenGrantChoices
        choices={[choice]}
        selections={selections}
        readOnly={false}
        onChange={setSelections}
      />
    )
  }

  return renderWithAppProviders(<Harness />)
}

function createChoice(
  duplicatePolicy: CharacterBuilderChosenGrantChoiceViewDto['duplicatePolicy']
): CharacterBuilderChosenGrantChoiceViewDto {
  return {
    id: 'choice-skills',
    grantId: 'grant-skills',
    grantKind: 'PROFICIENCY_GRANT',
    label: 'Skill Proficiencies',
    sourceLabel: 'Barbarian',
    source: { kind: 'CLASS', classId: 'class-barbarian', classLevel: 1 },
    timing: { kind: 'CLASS_LEVEL', classId: 'class-barbarian', classLevel: 1 },
    requiredCount: 2,
    duplicatePolicy,
    selectedTargetIds: ['skill-arcana', 'skill-athletics'],
    options: [
      { id: 'skill-arcana', label: 'Arcana' },
      { id: 'skill-athletics', label: 'Athletics' },
      { id: 'skill-perception', label: 'Perception' }
    ]
  }
}
