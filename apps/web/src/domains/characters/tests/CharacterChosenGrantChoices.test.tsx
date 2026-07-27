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
  it('renders one bounded multi-select for UNIQUE selections', async () => {
    const user = userEvent.setup()

    renderChosenGrantChoices(createChoice('UNIQUE'))

    const field = screen.getByRole('combobox', { name: /^choose 2$/i })
    expect(screen.queryByText('Barbarian')).not.toBeInTheDocument()

    await user.click(field)

    expect(await screen.findAllByRole('option', { hidden: true, name: 'Arcana' })).toHaveLength(1)
    expect(screen.getAllByRole('option', { hidden: true, name: 'Perception' })).toHaveLength(1)
    expect(screen.getAllByRole('option', { hidden: true, name: 'Athletics' })).toHaveLength(1)
  })

  it('keeps selected values available in every REPEATABLE slot', async () => {
    const user = userEvent.setup()

    renderChosenGrantChoices(createChoice('REPEATABLE'))

    await user.click(screen.getByRole('combobox', { name: /choice 1 of 2/i }))

    expect(await screen.findAllByRole('option', { hidden: true, name: 'Arcana' })).toHaveLength(2)
    expect(screen.getAllByRole('option', { hidden: true, name: 'Athletics' })).toHaveLength(2)
    expect(screen.getAllByRole('option', { hidden: true, name: 'Perception' })).toHaveLength(2)
  })

  it('renders spell grants as feature cards without a source subtitle', () => {
    renderChosenGrantChoices(
      {
        ...createChoice('UNIQUE'),
        grantKind: 'SPELL_GRANT',
        label: 'Cantrip',
        requiredCount: 1
      },
      'feature'
    )

    expect(screen.queryByText('Choices')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /^choose 1$/i })).toBeInTheDocument()
    expect(screen.queryByText('Barbarian')).not.toBeInTheDocument()
  })

  it('disables a proficiency selected by another grant immediately', async () => {
    const user = userEvent.setup()
    const choice = createChoice('UNIQUE')
    const otherChoice: CharacterBuilderChosenGrantChoiceViewDto = {
      ...choice,
      id: 'choice-background-skills',
      grantId: 'grant-background-skills',
      sourceLabel: 'Sage',
      source: { kind: 'BACKGROUND', backgroundId: 'background-sage' },
      timing: { kind: 'IMMEDIATE' },
      requiredCount: 1,
      selectedTargetIds: ['skill-perception']
    }

    renderChosenGrantChoices(
      choice,
      undefined,
      [choice, otherChoice],
      [
        {
          id: 'selection-skills',
          grantId: choice.grantId,
          source: choice.source,
          timing: choice.timing,
          targetIds: ['skill-arcana', 'skill-athletics']
        },
        {
          id: 'selection-background-skills',
          grantId: otherChoice.grantId,
          source: otherChoice.source,
          timing: otherChoice.timing,
          targetIds: ['skill-perception']
        }
      ]
    )

    await user.click(screen.getByRole('combobox', { name: /^choose 2$/i }))

    expect(
      await screen.findByRole('option', {
        hidden: true,
        name: /perception .*already has full proficiency/i
      })
    ).toHaveAttribute('data-combobox-disabled', 'true')
  })
})

function renderChosenGrantChoices(
  choice: CharacterBuilderChosenGrantChoiceViewDto,
  presentation?: 'feature',
  allChoices: CharacterBuilderChosenGrantChoiceViewDto[] = [choice],
  initialSelections: NonNullable<CharacterFormValues['intent']['chosenGrantSelections']> = [
    {
      id: 'selection-skills',
      grantId: choice.grantId,
      source: choice.source,
      timing: choice.timing,
      targetIds: ['skill-arcana', 'skill-athletics']
    }
  ]
) {
  function Harness() {
    const [selections, setSelections] =
      useState<CharacterFormValues['intent']['chosenGrantSelections']>(initialSelections)

    return (
      <CharacterChosenGrantChoices
        allChoices={allChoices}
        choices={[choice]}
        selections={selections}
        readOnly={false}
        presentation={presentation}
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
    proficiencyKind: 'SKILL',
    proficiencyLevel: 'FULL',
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
