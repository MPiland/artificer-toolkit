import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo } from 'react'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import {
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import { useAppForm } from '#forms/app-form/AppForm'
import { AuthoringLayoutContent } from '#forms/layout/AuthoringLayout'
import { AuthoringFormProvider } from '#forms/layout/AuthoringFormProvider'
import {
  useAuthoringNavigation,
  type AuthoringHostedForm
} from '#forms/layout/AuthoringFormContext'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  characterBuilderDraftPayloadFixture,
  characterBuilderPayloadFixture
} from '../fixtures/characterBuilder.fixtures'
import type { CharacterFormValues } from './characterBuilder.types'
import { toCharacterFormValues } from '../shared/formNormalization'
import { createStartingEquipmentDecision } from '../steps/equipment/startingEquipment'
import {
  CHARACTER_BUILDER_TIMING_MARK,
  CHARACTER_BUILDER_TIMING_MEASURE
} from './characterBuilder.performance'
import {
  characterBuilderVisibleSteps,
  getCharacterBuilderProgressState
} from '../state/characterBuilderAuthoringState'
import { CharacterBuilderRenderer } from './CharacterBuilderRenderer'

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined
})

describe('CharacterBuilderRenderer', () => {
  it('keeps a pristine form clean when navigating between steps', async () => {
    const user = userEvent.setup()

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'ABILITIES'
        }
      }
    })

    expect(screen.getByRole('status', { name: 'builder dirty state' })).toHaveTextContent('false')

    await user.click(screen.getByRole('link', { name: 'Race' }))

    expect(screen.getByRole('status', { name: 'builder dirty state' })).toHaveTextContent('false')
  })

  it('renders the recommended builder step and navigates through steps', async () => {
    const user = userEvent.setup()

    renderCharacterBuilderHarness({ payload: characterBuilderPayloadFixture })

    expect(screen.getByRole('heading', { level: 2, name: /basics/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /character name/i })).toHaveValue('Astra Vale')

    await user.click(screen.getByRole('link', { name: /next/i }))

    expect(screen.getByRole('heading', { level: 2, name: /race/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change race/i })).toBeInTheDocument()
    expect(screen.queryByText(/source context/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/resolver reports/i)).not.toBeInTheDocument()
  })

  it('uses textareas for profile reference fields and activates the Notes editor on demand', async () => {
    const user = userEvent.setup()
    const payload = {
      ...characterBuilderPayloadFixture,
      character: {
        ...characterBuilderPayloadFixture.character,
        profile: {
          ...characterBuilderPayloadFixture.character.profile,
          notes: '<p>Confirm the harbor master knows about the crate.</p>'
        }
      }
    }

    renderCharacterBuilderHarness({ payload })

    for (let index = 0; index < 7; index += 1) {
      await user.click(screen.getByRole('link', { name: /next/i }))
    }

    expect(screen.getByRole('heading', { level: 2, name: /^notes$/i })).toBeInTheDocument()

    for (const label of [
      'Personality Traits',
      'Ideals',
      'Bonds',
      'Flaws',
      'Organizations',
      'Allies',
      'Enemies',
      'Backstory'
    ]) {
      expect(screen.getByLabelText(label).tagName).toBe('TEXTAREA')
    }

    const notesShell = screen.getByRole('button', { name: 'Edit Notes' })
    expect(notesShell).toHaveTextContent(/confirm the harbor master/i)
    expect(
      screen
        .queryAllByLabelText('Notes')
        .find((element) => element.getAttribute('contenteditable') === 'true')
    ).toBeUndefined()

    fireEvent.click(notesShell)

    await waitFor(() => {
      const richTextNotes = screen
        .getAllByLabelText('Notes')
        .find((element) => element.getAttribute('contenteditable') === 'true')

      expect(richTextNotes).toHaveAttribute('contenteditable', 'true')
      expect(richTextNotes).toHaveTextContent(/confirm the harbor master/i)
    })
  })

  it('activates Notes from keyboard focus and transfers focus to the rich editor', async () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'NOTES'
        }
      }
    })

    const notesShell = screen.getByRole('button', { name: 'Edit Notes' })
    fireEvent.focus(notesShell)

    await waitFor(() => {
      const richTextNotes = screen
        .getAllByLabelText('Notes')
        .find((element) => element.getAttribute('contenteditable') === 'true')
      expect(richTextNotes).toHaveFocus()
    })
  })

  it('records a panel-commit measure after step navigation', async () => {
    const user = userEvent.setup()
    performance.clearMarks(CHARACTER_BUILDER_TIMING_MARK.BUILDER_SHELL_READY)
    performance.clearMarks(CHARACTER_BUILDER_TIMING_MARK.HYDRATION_COMPLETED)
    performance.clearMarks(CHARACTER_BUILDER_TIMING_MARK.FIRST_ACTIVE_PANEL_COMMITTED)
    performance.clearMarks(CHARACTER_BUILDER_TIMING_MARK.STEP_NAVIGATION_INTENT)
    performance.clearMarks(CHARACTER_BUILDER_TIMING_MARK.STEP_PANEL_COMMITTED)
    performance.clearMeasures(CHARACTER_BUILDER_TIMING_MEASURE.STEP_NAVIGATION)

    renderCharacterBuilderHarness({ payload: characterBuilderPayloadFixture })

    await waitFor(() => {
      expect(
        performance.getEntriesByName(CHARACTER_BUILDER_TIMING_MARK.BUILDER_SHELL_READY, 'mark')
      ).toHaveLength(1)
      expect(
        performance.getEntriesByName(
          CHARACTER_BUILDER_TIMING_MARK.FIRST_ACTIVE_PANEL_COMMITTED,
          'mark'
        )
      ).toHaveLength(1)
    })

    await user.click(screen.getByRole('link', { name: /next/i }))

    await waitFor(() => {
      expect(
        performance.getEntriesByName(CHARACTER_BUILDER_TIMING_MEASURE.STEP_NAVIGATION, 'measure')
      ).toHaveLength(1)
    })
    expect(
      performance.getEntriesByName(CHARACTER_BUILDER_TIMING_MARK.STEP_PANEL_COMMITTED, 'mark')
    ).toHaveLength(1)
  })

  it('uses draft readiness from the backend view to keep activation unavailable', async () => {
    const user = userEvent.setup()

    renderCharacterBuilderHarness({ payload: characterBuilderDraftPayloadFixture })

    for (let index = 0; index < 8; index += 1) {
      const nextLink = screen.queryByRole('link', { name: /next/i })
      if (!nextLink) break
      await user.click(nextLink)
    }

    expect(screen.getByText(/needs attention/i)).toBeInTheDocument()
    expect(screen.getByText(/choose a race/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^activate$/i })).toBeDisabled()
  })

  it('publishes builder step statuses for the authoring rail', async () => {
    renderCharacterBuilderHarness({ payload: characterBuilderDraftPayloadFixture })

    await waitFor(() => {
      expect(screen.getByLabelText('builder step statuses')).toHaveTextContent(
        '"RACE":"incomplete"'
      )
    })
    expect(screen.getByLabelText('builder step statuses')).toHaveTextContent(
      '"BASICS":"incomplete"'
    )
  })

  it('marks the section the service names for an outstanding choice, not the source class', async () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          outstandingChoices: [
            {
              code: 'CLASS_STARTING_EQUIPMENT_REQUIRED',
              sectionId: 'EQUIPMENT',
              message: 'Wizard has starting equipment choices to resolve.',
              sourceLabel: 'Wizard',
              required: true
            }
          ]
        },
        view: {
          ...characterBuilderPayloadFixture.view,
          equipment: {
            ...characterBuilderPayloadFixture.view.equipment,
            classStartingEquipmentRequired: true
          }
        }
      }
    })

    await waitFor(() => {
      expect(screen.getByLabelText('builder step statuses')).toHaveTextContent(
        '"CLASSES":"complete"'
      )
    })
    expect(screen.getByLabelText('builder step statuses')).toHaveTextContent(
      '"EQUIPMENT":"incomplete"'
    )
  })

  it('routes service validations to the section the service names', async () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          validations: [
            {
              code: 'STALE_ANCESTRY_SELECTION',
              sectionId: 'RACE',
              severity: 'blocking',
              message: 'The ancestry selection is stale.'
            },
            {
              code: 'MULTICLASS_PREREQUISITE_UNMET',
              sectionId: 'CLASSES',
              severity: 'blocking',
              message: 'The multiclass prerequisite is not met.'
            },
            {
              code: 'INVALID_HITPOINT_PROGRESSION',
              sectionId: 'ABILITIES',
              severity: 'blocking',
              message: 'The hitpoint progression is invalid.'
            }
          ]
        }
      }
    })

    await waitFor(() => {
      expect(screen.getByLabelText('builder step statuses')).toHaveTextContent('"RACE":"error"')
    })
    expect(screen.getByLabelText('builder step statuses')).toHaveTextContent('"CLASSES":"error"')
    expect(screen.getByLabelText('builder step statuses')).toHaveTextContent('"ABILITIES":"error"')
  })

  it('adds a selected class before resolver refresh', async () => {
    const user = userEvent.setup()
    const resolvedValues: CharacterFormValues[] = []

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderDraftPayloadFixture,
        resolution: {
          ...characterBuilderDraftPayloadFixture.resolution,
          recommendedSectionId: 'CLASSES'
        }
      },
      resolveDebounceMs: 1,
      onResolve: (character) => {
        resolvedValues.push(character)
      }
    })

    await user.click(screen.getByRole('button', { name: /^add class$/i }))
    const chooser = await screen.findByRole('dialog', { name: /choose a class/i })
    await user.click(within(chooser).getByRole('radio', { name: /wizard/i }))
    await user.click(within(chooser).getByRole('button', { name: /^add class$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /choose a class/i })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /change class/i })).toBeInTheDocument()
    expect(screen.getByText('Wizard')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^wizard level$/i })).toHaveValue('1')
    await waitFor(() => {
      expect(resolvedValues.at(-1)?.intent.classes).toEqual([
        {
          classId: 'class-wizard',
          classLevel: 1
        }
      ])
    })
  })

  it('applies a selected subrace before resolver refresh', async () => {
    const user = userEvent.setup()
    const resolvedValues: CharacterFormValues[] = []

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderDraftPayloadFixture,
        resolution: {
          ...characterBuilderDraftPayloadFixture.resolution,
          recommendedSectionId: 'RACE'
        }
      },
      resolveDebounceMs: 1,
      onResolve: (character) => {
        resolvedValues.push(character)
      }
    })

    await user.click(screen.getByRole('button', { name: /^choose race$/i }))
    const chooser = await screen.findByRole('dialog', { name: /choose a race/i })
    await user.click(within(chooser).getByRole('radio', { name: /^sea elf$/i }))
    await user.click(within(chooser).getByRole('button', { name: /^choose race$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /choose a race/i })).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(resolvedValues.at(-1)?.intent.race).toEqual({
        raceId: 'race-elf',
        subraceId: 'subrace-sea-elf'
      })
    })
  })

  it('keeps race-dependent selections when the current subrace is confirmed again', async () => {
    const user = userEvent.setup()

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'RACE'
        }
      }
    })

    expect(screen.getByRole('combobox', { name: /elven lineage option/i })).toHaveValue('Ocean')

    await user.click(screen.getByRole('button', { name: /change race/i }))
    const chooser = await screen.findByRole('dialog', { name: /choose a race/i })
    expect(within(chooser).getByText('Current')).toBeInTheDocument()
    await user.click(within(chooser).getByRole('radio', { name: /sea elf/i }))
    await user.click(within(chooser).getByRole('button', { name: /^change race$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /choose a race/i })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('combobox', { name: /elven lineage option/i })).toHaveValue('Ocean')
  })

  it('keeps class-dependent selections when the current class is confirmed again', async () => {
    const user = userEvent.setup()

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            classes: [
              {
                classId: 'class-wizard',
                classLevel: 1,
                subclassId: 'subclass-scribe',
                specializationId: 'scribe-awakened'
              }
            ]
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'CLASSES'
        }
      }
    })

    expect(screen.getByRole('combobox', { name: /^subclass$/i })).toHaveValue('Order of Scribes')
    expect(screen.getByRole('combobox', { name: /^specialization/i })).toHaveValue('Awakened Quill')

    await user.click(screen.getByRole('button', { name: /change class/i }))
    const chooser = await screen.findByRole('dialog', { name: /change class/i })
    expect(within(chooser).getByText('Current')).toBeInTheDocument()
    await user.click(within(chooser).getByRole('radio', { name: /wizard/i }))
    await user.click(within(chooser).getByRole('button', { name: /^change class$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /change class/i })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('combobox', { name: /^subclass$/i })).toHaveValue('Order of Scribes')
    expect(screen.getByRole('combobox', { name: /^specialization/i })).toHaveValue('Awakened Quill')
  })

  it('resolves after replacing the background-owned intent subtree', async () => {
    const user = userEvent.setup()
    const resolvedValues: CharacterFormValues[] = []

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderDraftPayloadFixture,
        resolution: {
          ...characterBuilderDraftPayloadFixture.resolution,
          recommendedSectionId: 'BACKGROUND'
        }
      },
      resolveDebounceMs: 1,
      onResolve: (character) => {
        resolvedValues.push(character)
      }
    })

    await user.click(screen.getByRole('button', { name: /background$/i }))
    const chooser = await screen.findByRole('dialog', { name: /background/i })
    await user.click(within(chooser).getByRole('radio', { name: /sage/i }))
    await user.click(within(chooser).getByRole('button', { name: /^choose background$/i }))

    await waitFor(() => {
      expect(resolvedValues.at(-1)?.intent.background?.backgroundId).toBe('background-sage')
    })
  })

  it('renders backend-provided background context and suggested characteristics', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'BACKGROUND'
        }
      }
    })

    expect(screen.getByText(/spent years learning the lore/i)).toBeInTheDocument()
    expect(screen.getByText('Sources of information')).toBeInTheDocument()
    const disclosure = screen.getByText('Suggested Characteristics').closest('details')
    expect(disclosure).not.toHaveAttribute('open')
    expect(screen.getByText('Personality Trait 1')).toBeInTheDocument()
  })

  it('adds a suggested background characteristic to the editable character profile', async () => {
    const user = userEvent.setup()

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          profile: {
            ...characterBuilderPayloadFixture.character.profile,
            personalityTraits: ''
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'BACKGROUND'
        }
      }
    })

    await user.click(screen.getByText('Suggested Characteristics'))
    await user.click(screen.getByRole('button', { name: 'Use Personality Trait 1' }))

    expect(screen.getByRole('button', { name: 'Remove Personality Trait 1' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await user.click(screen.getByRole('link', { name: 'Notes' }))
    expect(screen.getByLabelText('Personality Traits')).toHaveValue(
      'I use polysyllabic words that convey the impression of great erudition.'
    )
  })

  it('does not resolve again for prose-only edits', async () => {
    vi.useFakeTimers()
    const resolvedValues: CharacterFormValues[] = []

    try {
      renderCharacterBuilderHarness({
        payload: characterBuilderPayloadFixture,
        resolveDebounceMs: 1,
        showProseEditTestToggle: true,
        onResolve: (character) => {
          resolvedValues.push(character)
        }
      })

      await act(async () => vi.advanceTimersByTimeAsync(2))
      expect(resolvedValues).toHaveLength(0)

      fireEvent.click(screen.getByRole('button', { name: /update table notes/i }))
      await act(async () => vi.advanceTimersByTimeAsync(2))

      expect(resolvedValues).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders resolver-provided starting equipment choices on the equipment step', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'EQUIPMENT'
        },
        view: {
          ...characterBuilderPayloadFixture.view,
          equipment: {
            ...characterBuilderPayloadFixture.view.equipment,
            classStartingEquipmentRequired: true,
            classStartingEquipment: {
              source: 'CLASS',
              sourceLabel: 'Wizard',
              choiceLabels: { 'wizard-choice': 'Choose 1 Quarterstaff or Scholar Pack' },
              startingEquipment: {
                id: 'wizard-starting-equipment',
                sets: [
                  {
                    id: 'wizard-set',
                    order: 1,
                    groups: [
                      {
                        id: 'wizard-group',
                        order: 1,
                        options: [
                          {
                            id: 'wizard-option',
                            order: 1,
                            items: [
                              {
                                id: 'wizard-choice',
                                order: 1,
                                startingEquipmentKind: 'EQUIPMENT',
                                selectionKind: 'CHOSEN',
                                count: 1,
                                authoringModeKind: 'SELECTED',
                                equipmentIds: ['equipment-staff', 'equipment-pack']
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    })

    expect(screen.getByRole('heading', { level: 2, name: /equipment/i })).toBeInTheDocument()
    expect(screen.getByText(/^wizard$/i)).toBeInTheDocument()
    expect(screen.queryByText(/^group 1$/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /group 1/i })).not.toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: /choose 1 quarterstaff or scholar pack/i })
    ).toBeInTheDocument()
  })

  it('resolves after selecting a starting equipment group option', async () => {
    const user = userEvent.setup()
    const resolvedValues: CharacterFormValues[] = []

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            startingEquipment: undefined
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'EQUIPMENT'
        },
        view: {
          ...characterBuilderPayloadFixture.view,
          equipment: {
            ...characterBuilderPayloadFixture.view.equipment,
            classStartingEquipmentRequired: true,
            classStartingEquipment: {
              source: 'CLASS',
              sourceLabel: 'Wizard',
              choiceLabels: {},
              startingEquipment: {
                id: 'wizard-starting-equipment',
                sets: [
                  {
                    id: 'wizard-set',
                    order: 1,
                    groups: [
                      {
                        id: 'wizard-group',
                        order: 1,
                        options: [
                          {
                            id: 'staff-option',
                            order: 1,
                            items: [
                              {
                                id: 'staff-item',
                                order: 1,
                                startingEquipmentKind: 'EQUIPMENT',
                                selectionKind: 'GRANTED',
                                quantity: 1,
                                authoringModeKind: 'SELECTED',
                                equipmentIds: ['equipment-staff']
                              }
                            ]
                          },
                          {
                            id: 'pack-option',
                            order: 2,
                            items: [
                              {
                                id: 'pack-item',
                                order: 1,
                                startingEquipmentKind: 'EQUIPMENT',
                                selectionKind: 'GRANTED',
                                quantity: 1,
                                authoringModeKind: 'SELECTED',
                                equipmentIds: ['equipment-pack']
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      resolveDebounceMs: 1,
      onResolve: (character) => {
        resolvedValues.push(character)
      }
    })

    await user.click(screen.getByRole('combobox', { name: /choose one/i }))
    const quarterstaffOptions = await screen.findAllByRole('option', {
      hidden: true,
      name: 'Quarterstaff'
    })
    fireEvent.click(
      quarterstaffOptions.find((option) => option.getAttribute('value') === 'staff-option')!
    )

    await waitFor(() => {
      expect(resolvedValues.at(-1)?.intent.startingEquipment?.class?.groups).toEqual([
        {
          groupId: 'wizard-group',
          optionId: 'staff-option',
          selections: []
        }
      ])
    })
  })

  it('renders resolver-provided source-local features and embedded choices on the owning step', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'RACE'
        },
        view: {
          ...characterBuilderPayloadFixture.view,
          race: {
            ...characterBuilderPayloadFixture.view.race,
            features: [
              {
                id: 'feature-elven-training',
                label: 'Elven Training',
                description: '<p>Choose one practiced elven skill.</p>',
                sourceLabel: 'Elf',
                source: { kind: 'RACE', raceId: 'race-elf' }
              }
            ],
            featureChoices: [
              {
                featureId: 'feature-elven-training',
                featureLabel: 'Elven Training',
                sourceLabel: 'Elf',
                source: { kind: 'RACE', raceId: 'race-elf' },
                selectionKey: 'options',
                requiredCount: 2,
                selectedOptionIds: [],
                options: [
                  { id: 'option-perception', label: 'Perception' },
                  { id: 'option-stealth', label: 'Stealth' },
                  { id: 'option-survival', label: 'Survival' }
                ]
              }
            ]
          }
        }
      }
    })

    expect(screen.getByRole('heading', { level: 2, name: /race/i })).toBeInTheDocument()
    expect(screen.getByText(/choose one practiced elven skill/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /^choose 2$/i })).toBeInTheDocument()
  })

  it('renders race spell grants as feature cards instead of standalone choices', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'RACE'
        },
        view: {
          ...characterBuilderPayloadFixture.view,
          race: {
            ...characterBuilderPayloadFixture.view.race,
            grantChoices: [
              {
                id: 'choice-high-elf-cantrip',
                grantId: 'grant-high-elf-cantrip',
                grantKind: 'SPELL_GRANT',
                label: 'Cantrip',
                ownerFeatureId: 'feature-high-elf-cantrip',
                sourceLabel: 'High Elf',
                source: { kind: 'SUBRACE', subraceId: 'race-high-elf' },
                timing: { kind: 'IMMEDIATE' },
                requiredCount: 1,
                duplicatePolicy: 'UNIQUE',
                selectedTargetIds: [],
                options: [{ id: 'spell-acid-splash', label: 'Acid Splash' }]
              }
            ],
            features: [
              {
                id: 'feature-high-elf-cantrip',
                label: 'Cantrip',
                description: '<p>You know one wizard cantrip of your choice.</p>',
                sourceLabel: 'High Elf',
                source: { kind: 'SUBRACE', subraceId: 'race-high-elf' }
              },
              {
                id: 'feature-darkvision',
                label: 'Darkvision',
                description: '<p>You can see in dim light within 60 feet.</p>',
                sourceLabel: 'Elf',
                source: { kind: 'RACE', raceId: 'race-elf' }
              }
            ],
            featureChoices: []
          }
        }
      }
    })

    expect(screen.queryByText('Features')).not.toBeInTheDocument()
    expect(screen.getByText('Darkvision')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /^choose 1$/i })).toBeInTheDocument()
    expect(screen.queryByText('Choices')).not.toBeInTheDocument()
    expect(screen.queryByText('High Elf')).not.toBeInTheDocument()
  })

  it('shows Dragonborn ancestry choices after the resolver selects Dragonborn', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            race: { raceId: 'race-dragonborn' },
            ancestrySelections: undefined
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'RACE',
          summary: {
            ...characterBuilderPayloadFixture.resolution.summary,
            selectedRace: {
              raceId: 'race-dragonborn',
              raceLabel: 'Dragonborn',
              ancestryId: 'ancestry-draconic',
              ancestryLabel: 'Draconic Ancestry'
            }
          },
          outstandingChoices: [
            {
              code: 'ANCESTRY_SELECTION_REQUIRED',
              sectionId: 'RACE',
              message: 'Choose a Draconic Ancestry option.',
              sourceLabel: 'Draconic Ancestry',
              required: true
            }
          ],
          readiness: {
            ...characterBuilderPayloadFixture.resolution.readiness,
            ready: false,
            outstandingRequiredChoices: ['Draconic Ancestry']
          }
        },
        view: {
          ...characterBuilderPayloadFixture.view,
          race: {
            raceOptions: [{ id: 'race-dragonborn', label: 'Dragonborn' }],
            subraceOptions: [],
            grantChoices: [],
            ancestry: {
              ancestryId: 'ancestry-draconic',
              label: 'Draconic Ancestry',
              options: [
                { id: 'ancestry-red', label: 'Red (Fire)' },
                { id: 'ancestry-blue', label: 'Blue (Lightning)' }
              ]
            },
            features: [
              {
                id: 'feature-draconic-ancestry',
                label: 'Draconic Ancestry',
                description: '<p>Choose one type of dragon from the Draconic Ancestry table.</p>',
                sourceLabel: 'Dragonborn',
                source: { kind: 'RACE', raceId: 'race-dragonborn' }
              }
            ],
            featureChoices: []
          }
        }
      }
    })

    expect(screen.getByText('Dragonborn')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /draconic ancestry option/i })).toBeInTheDocument()
    expect(screen.getByText(/choose one type of dragon/i)).toBeInTheDocument()
  })

  it('renders backend-supplied ancestry previews before delayed resolution completes', async () => {
    const user = userEvent.setup()
    const pendingResolution = deferred<void>()
    const dragonbornPayload: CharacterBuilderPayloadDto = {
      ...characterBuilderPayloadFixture,
      character: {
        ...characterBuilderPayloadFixture.character,
        intent: {
          ...characterBuilderPayloadFixture.character.intent,
          race: { raceId: 'race-dragonborn' },
          ancestrySelections: undefined
        }
      },
      references: {
        ...characterBuilderPayloadFixture.references,
        races: [
          ...characterBuilderPayloadFixture.references.races,
          {
            id: 'race-dragonborn',
            label: 'Dragonborn',
            category: 'RACE',
            ancestry: {
              id: 'ancestry-draconic',
              label: 'Draconic Ancestry',
              options: [
                {
                  id: 'ancestry-red',
                  label: 'Red (Fire)',
                  features: [
                    {
                      id: 'feature-breath-weapon',
                      label: 'Breath Weapon',
                      description:
                        '<p>You can exhale destructive energy tied to your ancestry.</p>',
                      sourceLabel: 'Red (Fire)',
                      source: {
                        kind: 'ANCESTRY',
                        ancestryId: 'ancestry-draconic',
                        optionId: 'ancestry-red'
                      }
                    }
                  ]
                }
              ]
            }
          }
        ]
      },
      resolution: {
        ...characterBuilderPayloadFixture.resolution,
        recommendedSectionId: 'RACE',
        summary: {
          ...characterBuilderPayloadFixture.resolution.summary,
          selectedRace: {
            raceId: 'race-dragonborn',
            raceLabel: 'Dragonborn',
            ancestryId: 'ancestry-draconic',
            ancestryLabel: 'Draconic Ancestry'
          }
        }
      },
      view: {
        ...characterBuilderPayloadFixture.view,
        race: {
          raceOptions: [{ id: 'race-dragonborn', label: 'Dragonborn' }],
          subraceOptions: [],
          grantChoices: [],
          ancestry: {
            ancestryId: 'ancestry-draconic',
            label: 'Draconic Ancestry',
            options: [{ id: 'ancestry-red', label: 'Red (Fire)' }]
          },
          features: [
            {
              id: 'feature-draconic-ancestry',
              label: 'Draconic Ancestry',
              description: '<p>Choose one type of dragon.</p>',
              sourceLabel: 'Dragonborn',
              source: { kind: 'RACE', raceId: 'race-dragonborn' }
            }
          ],
          featureChoices: []
        }
      }
    }

    renderCharacterBuilderHarness({
      payload: dragonbornPayload,
      resolveDebounceMs: 0,
      onResolve: () => pendingResolution.promise
    })

    await user.click(screen.getByRole('combobox', { name: /draconic ancestry option/i }))
    fireEvent.click(await screen.findByRole('option', { hidden: true, name: 'Red (Fire)' }))

    expect(screen.getByText('Breath Weapon')).toBeInTheDocument()
    expect(screen.getByText(/destructive energy tied to your ancestry/i)).toBeInTheDocument()
    const resolverContent = document.querySelector(
      '[aria-labelledby="character-builder-active-step-title"]'
    )
    await waitFor(() => expect(resolverContent).toHaveAttribute('aria-busy', 'true'))

    await act(async () => pendingResolution.resolve())
    await waitFor(() => expect(resolverContent).toHaveAttribute('aria-busy', 'false'))
  })

  it('renders ancestry-granted features after an ancestry option is selected', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            race: { raceId: 'race-dragonborn' },
            ancestrySelections: [
              {
                id: 'ancestry-red-selection',
                ancestryId: 'ancestry-draconic',
                optionId: 'ancestry-red',
                source: { kind: 'RACE', raceId: 'race-dragonborn' },
                timing: { kind: 'IMMEDIATE' }
              }
            ]
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'RACE',
          summary: {
            ...characterBuilderPayloadFixture.resolution.summary,
            selectedRace: {
              raceId: 'race-dragonborn',
              raceLabel: 'Dragonborn',
              ancestryId: 'ancestry-draconic',
              ancestryLabel: 'Draconic Ancestry',
              ancestryOptionId: 'ancestry-red',
              ancestryOptionLabel: 'Red (Fire)'
            }
          }
        },
        view: {
          ...characterBuilderPayloadFixture.view,
          race: {
            raceOptions: [{ id: 'race-dragonborn', label: 'Dragonborn' }],
            subraceOptions: [],
            grantChoices: [],
            ancestry: {
              ancestryId: 'ancestry-draconic',
              label: 'Draconic Ancestry',
              selectedOptionId: 'ancestry-red',
              options: [
                { id: 'ancestry-red', label: 'Red (Fire)' },
                { id: 'ancestry-blue', label: 'Blue (Lightning)' }
              ]
            },
            features: [
              {
                id: 'feature-breath-weapon',
                label: 'Breath Weapon',
                description: '<p>You can exhale destructive energy tied to your ancestry.</p>',
                sourceLabel: 'Red (Fire)',
                source: {
                  kind: 'ANCESTRY',
                  ancestryId: 'ancestry-draconic',
                  optionId: 'ancestry-red'
                }
              },
              {
                id: 'feature-damage-resistance',
                label: 'Damage Resistance',
                description: '<p>You have resistance to fire damage.</p>',
                sourceLabel: 'Red (Fire)',
                source: {
                  kind: 'ANCESTRY',
                  ancestryId: 'ancestry-draconic',
                  optionId: 'ancestry-red'
                }
              }
            ],
            featureChoices: []
          }
        }
      }
    })

    expect(screen.getByText(/breath weapon/i)).toBeInTheDocument()
    expect(screen.getByText(/destructive energy tied to your ancestry/i)).toBeInTheDocument()
    expect(screen.getByText(/damage resistance/i)).toBeInTheDocument()
    expect(screen.getByText(/resistance to fire damage/i)).toBeInTheDocument()
  })

  it('renders active class feature descriptions even when no options are required', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'CLASSES'
        }
      }
    })

    expect(screen.getByRole('heading', { level: 2, name: /classes/i })).toBeInTheDocument()
    expect(screen.getAllByText(/spellcasting/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/prepare and cast wizard spells/i)).toBeInTheDocument()
  })

  it('keeps class-owned feature choices selected when only class level changes', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            featureAcquisitions: [
              {
                id: 'feature-acquisition-arcane-training',
                featureId: 'feature-arcane-training',
                source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
                timing: { kind: 'CLASS_LEVEL', classId: 'class-wizard', classLevel: 1 },
                selections: [
                  {
                    selectionKey: 'options',
                    values: [{ kind: 'ID', id: 'option-arcana' }]
                  }
                ]
              }
            ]
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'CLASSES'
        },
        view: {
          ...characterBuilderPayloadFixture.view,
          classes: {
            ...characterBuilderPayloadFixture.view.classes,
            selectedClasses: [
              {
                ...characterBuilderPayloadFixture.view.classes.selectedClasses[0],
                classLevel: 5,
                features: [
                  {
                    id: 'feature-arcane-training',
                    label: 'Arcane Training',
                    description: '<p>Choose a scholarly skill.</p>',
                    sourceLabel: 'Wizard',
                    source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 5 }
                  }
                ],
                featureChoices: [
                  {
                    featureId: 'feature-arcane-training',
                    featureLabel: 'Arcane Training',
                    sourceLabel: 'Wizard',
                    source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 5 },
                    selectionKey: 'options',
                    requiredCount: 1,
                    selectedOptionIds: ['option-arcana'],
                    options: [
                      { id: 'option-arcana', label: 'Arcana' },
                      { id: 'option-history', label: 'History' }
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    })

    expect(screen.getByRole('combobox', { name: /^choose 1$/i })).toHaveValue('Arcana')
  })

  it('renders resolver-provided class spell choices in the class spells tab', async () => {
    const user = userEvent.setup()
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'CLASSES'
        },
        view: {
          ...characterBuilderPayloadFixture.view,
          classes: {
            ...characterBuilderPayloadFixture.view.classes,
            selectedClasses: [
              {
                ...characterBuilderPayloadFixture.view.classes.selectedClasses[0],
                spellChoices: [
                  {
                    id: 'class-wizard:spellcasting',
                    label: 'Wizard Spellcasting',
                    sourceLabel: 'Wizard',
                    source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
                    cantripLimit: 1,
                    learnedSpellLimit: 1,
                    spellCollectionLabel: 'Spellbook',
                    selectedCantripIds: [],
                    selectedSpellIds: [],
                    cantripOptions: [{ id: 'spell-mage-hand', label: 'Mage Hand', level: 0 }],
                    spellOptions: [{ id: 'spell-magic-missile', label: 'Magic Missile', level: 1 }]
                  }
                ]
              }
            ]
          }
        }
      }
    })

    expect(screen.getByRole('heading', { level: 2, name: /classes/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^features$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^spells$/i }))
    expect(screen.getByRole('region', { name: 'Cantrips' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Spellbook' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(2)

    const cantrips = screen.getByRole('region', { name: 'Cantrips' })
    await user.click(within(cantrips).getByRole('button', { name: 'Add' }))
    expect(within(cantrips).getByText('1 of 1 selected')).toBeInTheDocument()
    expect(within(cantrips).getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('uses system vocabulary for alignment and lifestyle', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'DETAILS'
        }
      }
    })

    expect(screen.getByRole('combobox', { name: 'Alignment' })).toHaveValue('Neutral Good')
    expect(screen.getByRole('combobox', { name: 'Lifestyle' })).toBeInTheDocument()
  })

  it('keeps class-owned spell choices selected when only class level changes', async () => {
    const user = userEvent.setup()
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            spellSelections: [
              {
                id: 'spell-selection-wizard',
                source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
                timing: { kind: 'CLASS_LEVEL', classId: 'class-wizard', classLevel: 1 },
                spells: ['spell-mage-hand']
              }
            ]
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'CLASSES'
        },
        view: {
          ...characterBuilderPayloadFixture.view,
          classes: {
            ...characterBuilderPayloadFixture.view.classes,
            selectedClasses: [
              {
                ...characterBuilderPayloadFixture.view.classes.selectedClasses[0],
                classLevel: 5,
                spellChoices: [
                  {
                    id: 'class-wizard:spellcasting',
                    label: 'Wizard Spellcasting',
                    sourceLabel: 'Wizard',
                    source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 5 },
                    cantripLimit: 1,
                    learnedSpellLimit: 0,
                    spellCollectionLabel: 'Spellbook',
                    selectedCantripIds: ['spell-mage-hand'],
                    selectedSpellIds: [],
                    cantripOptions: [{ id: 'spell-mage-hand', label: 'Mage Hand', level: 0 }],
                    spellOptions: []
                  }
                ]
              }
            ]
          }
        }
      }
    })

    await user.click(screen.getByRole('tab', { name: /^spells$/i }))
    expect(screen.getByText(/mage hand/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('clears class-owned choices and primary equipment when removing the primary class', async () => {
    const user = userEvent.setup()
    const resolvedValues: CharacterFormValues[] = []

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            startingEquipment: {
              class: createStartingEquipmentDecision('CLASS'),
              background: createStartingEquipmentDecision('BACKGROUND')
            },
            featureAcquisitions: [
              {
                id: 'class-feature-choice',
                featureId: 'class-feature',
                source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
                timing: { kind: 'IMMEDIATE' }
              },
              {
                id: 'background-feature-choice',
                featureId: 'background-feature',
                source: { kind: 'BACKGROUND', backgroundId: 'background-sage' },
                timing: { kind: 'IMMEDIATE' }
              }
            ],
            spellSelections: [
              {
                id: 'class-spell-choice',
                source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
                timing: { kind: 'IMMEDIATE' },
                spells: ['spell-magic-missile']
              }
            ],
            resourceGrants: [
              {
                id: 'class-resource-choice',
                resourceId: 'resource-arcane-recovery',
                source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
                timing: { kind: 'IMMEDIATE' }
              }
            ]
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'CLASSES'
        }
      },
      resolveDebounceMs: 1,
      onResolve: (character) => {
        resolvedValues.push(character)
      }
    })

    await user.click(screen.getByRole('button', { name: /remove/i }))

    await waitFor(() => {
      expect(resolvedValues.at(-1)?.intent.classes).toHaveLength(0)
    })

    const latestValues = resolvedValues.at(-1)
    expect(latestValues?.intent.startingEquipment?.class).toBeUndefined()
    expect(latestValues?.intent.startingEquipment?.background).toBeDefined()
    expect(latestValues?.intent.featureAcquisitions.map((acquisition) => acquisition.id)).toEqual([
      'background-feature-choice'
    ])
    expect(latestValues?.intent.spellSelections).toBeUndefined()
    expect(latestValues?.intent.resourceGrants).toBeUndefined()
  })

  it('normalizes class levels to integers before resolver refresh', async () => {
    const resolvedValues: CharacterFormValues[] = []

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'CLASSES'
        }
      },
      resolveDebounceMs: 1,
      onResolve: (character) => {
        resolvedValues.push(character)
      }
    })

    const classLevelInput = screen
      .getAllByLabelText(/wizard level/i)
      .find((element) => element instanceof HTMLInputElement)
    expect(classLevelInput).toBeDefined()
    expect(screen.queryByText('Level', { selector: 'label' })).not.toBeInTheDocument()

    fireEvent.change(classLevelInput as HTMLInputElement, { target: { value: '2.5' } })

    await waitFor(() => {
      expect(resolvedValues.at(-1)?.intent.classes[0]?.classLevel).toBe(2)
    })
  })

  it('keeps class proficiency guidance while hiding the redundant choice label', () => {
    const selectedClass = characterBuilderPayloadFixture.view.classes.selectedClasses[0]

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'CLASSES'
        },
        view: {
          ...characterBuilderPayloadFixture.view,
          classes: {
            ...characterBuilderPayloadFixture.view.classes,
            selectedClasses: selectedClass
              ? [
                  {
                    ...selectedClass,
                    proficiencyGroups: [
                      {
                        category: 'SKILLS',
                        label: 'Skills',
                        grantedEntries: [],
                        choiceInstructions: [
                          {
                            label: 'Choose 2 from Arcana, History, and Insight.',
                            required: true
                          }
                        ],
                        choiceIds: ['choice-skills']
                      }
                    ],
                    grantChoices: [
                      {
                        id: 'choice-skills',
                        grantId: 'grant-skills',
                        grantKind: 'PROFICIENCY_GRANT',
                        proficiencyKind: 'SKILL',
                        proficiencyLevel: 'FULL',
                        displayCategory: 'SKILLS',
                        label: 'Skill Proficiencies',
                        sourceLabel: 'Wizard',
                        source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
                        timing: { kind: 'CLASS_LEVEL', classId: 'class-wizard', classLevel: 1 },
                        requiredCount: 2,
                        duplicatePolicy: 'UNIQUE',
                        selectedTargetIds: [],
                        options: [
                          { id: 'skill-arcana', label: 'Arcana' },
                          { id: 'skill-history', label: 'History' },
                          { id: 'skill-insight', label: 'Insight' }
                        ]
                      }
                    ]
                  }
                ]
              : []
          }
        }
      }
    })

    expect(
      screen.getByText('Choose 2 from Arcana, History, and Insight.', { exact: false })
    ).toBeInTheDocument()
    expect(screen.getByText('Required', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Choose 2' })).toBeInTheDocument()
    expect(screen.queryByText('Choose 2', { selector: 'label' })).not.toBeInTheDocument()
  })

  it('updates ability method UI from the live form value before resolver refresh', async () => {
    const user = userEvent.setup()

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'ABILITIES'
        }
      },
      showAbilityMethodTestToggle: true
    })

    await user.click(screen.getByRole('link', { name: /abilities & hp/i }))

    expect(screen.getAllByRole('combobox', { name: /^score/i })).toHaveLength(6)
    expect(screen.getAllByRole('combobox', { name: /ability/i })).toHaveLength(7)
    expect(
      screen.queryByRole('button', { name: /fill six abilities|remove/i })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /set manual ability method/i }))

    expect(screen.getAllByRole('textbox', { name: /^score/i })).toHaveLength(6)
    expect(screen.getAllByRole('combobox', { name: /ability/i })).toHaveLength(7)
    expect(screen.getByRole('textbox', { name: /roll configuration/i })).toHaveValue('4d6dl1r1')
    expect(screen.getAllByRole('button', { name: /^roll$/i })).toHaveLength(6)
  })

  it('updates ancestry choice UI from the live form value before resolver refresh', async () => {
    const user = userEvent.setup()

    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'RACE'
        }
      },
      showAncestrySelectionTestToggle: true
    })

    expect(screen.getByRole('combobox', { name: /elven lineage/i })).toHaveValue('Ocean')
    expect(screen.queryByText('Forest Adaptation')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /set forest ancestry/i }))

    expect(screen.getByRole('combobox', { name: /elven lineage/i })).toHaveValue('Forest')
    expect(screen.getByText('Forest Adaptation')).toBeInTheDocument()
  })

  it('renders hit point entries from fixed character options without placeholder totals', async () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            hitpoints: {
              method: HITPOINT_CALCULATION_METHOD_CODE.FIXED,
              levels: []
            }
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'ABILITIES',
          summary: {
            ...characterBuilderPayloadFixture.resolution.summary,
            totalLevel: 1
          }
        }
      }
    })

    expect(screen.queryByText(/fixed hp is calculated automatically/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /add missing levels|move up|move down/i })
    ).not.toBeInTheDocument()
    expect(await screen.findByText(/maximum hp 7/i)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /fixed hp/i })).not.toBeInTheDocument()
  })

  it('adds later hit point levels from class hit dice and ability modifiers', async () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            classes: [
              {
                classId: 'class-wizard',
                classLevel: 2,
                subclassId: 'subclass-scribe'
              }
            ],
            hitpoints: {
              method: HITPOINT_CALCULATION_METHOD_CODE.FIXED,
              levels: []
            }
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'ABILITIES',
          summary: {
            ...characterBuilderPayloadFixture.resolution.summary,
            totalLevel: 2
          }
        }
      }
    })

    expect(await screen.findByText(/maximum hp 12/i)).toBeInTheDocument()
    expect(screen.getAllByText('7')).toHaveLength(1)
    expect(screen.getAllByText('5')).toHaveLength(1)
  })

  it('labels manual hit points as hit-die rolls', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            hitpoints: {
              method: HITPOINT_CALCULATION_METHOD_CODE.MANUAL,
              levels: [{ level: 1, classId: 'class-wizard', classLevel: 1, value: 7 }]
            }
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'ABILITIES'
        }
      }
    })

    expect(
      screen.queryByText(/enter the hit-die roll.*ability modifiers are applied automatically/i)
    ).not.toBeInTheDocument()
    expect(screen.getByText(/maximum hp 7/i)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /d6 roll/i })).not.toBeInTheDocument()
  })

  it('shows point-buy pool deltas relative to each current score', async () => {
    const user = userEvent.setup()
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        builderIntent: undefined,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            abilities: {
              method: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
              assignments: [{ ability: 'STRENGTH', option: '10' }]
            }
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'ABILITIES'
        }
      }
    })

    const scoreFields = screen.getAllByRole('combobox', { name: /^score for assignment/i })
    await user.click(scoreFields[1])
    expect(
      (await screen.findAllByRole('option', { hidden: true, name: '12 (-4)' })).length
    ).toBeGreaterThan(0)
    await user.keyboard('{Escape}')
    await user.click(scoreFields[0])
    expect(await screen.findByRole('option', { hidden: true, name: '12 (-2)' })).toBeInTheDocument()
  })

  it('renders read-only builder fields when the authoring state is read-only', () => {
    renderCharacterBuilderHarness({
      payload: characterBuilderPayloadFixture,
      readOnly: true
    })

    expect(screen.getByRole('textbox', { name: /character name/i })).toHaveAttribute('readonly')
  })

  it('keeps Notes read-only behavior unchanged', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'NOTES'
        }
      },
      readOnly: true
    })

    expect(screen.queryByRole('button', { name: 'Edit Notes' })).not.toBeInTheDocument()
    const richTextNotes = screen
      .getAllByLabelText('Notes')
      .find((element) => element.getAttribute('contenteditable') === 'false')
    expect(richTextNotes).toHaveAttribute('contenteditable', 'false')
  })

  it('renders one concise review surface without duplicating the global activate action', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'REVIEW'
        }
      }
    })

    expect(screen.getByRole('heading', { name: 'Ready to activate' })).toBeInTheDocument()
    expect(screen.getByText('6 of 6 assigned')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Activate' })).toHaveLength(1)
  })
})

function renderCharacterBuilderHarness({
  payload,
  readOnly = false,
  showAbilityMethodTestToggle = false,
  showAncestrySelectionTestToggle = false,
  showProseEditTestToggle = false,
  resolveDebounceMs = 60_000,
  onResolve = () => undefined
}: {
  payload: CharacterBuilderPayloadDto
  readOnly?: boolean
  showAbilityMethodTestToggle?: boolean
  showAncestrySelectionTestToggle?: boolean
  showProseEditTestToggle?: boolean
  resolveDebounceMs?: number
  onResolve?: (character: CharacterFormValues) => Promise<void> | void
}) {
  return renderWithAppProviders(
    <CharacterBuilderTestHarness
      onResolve={onResolve}
      payload={payload}
      readOnly={readOnly}
      resolveDebounceMs={resolveDebounceMs}
      showAncestrySelectionTestToggle={showAncestrySelectionTestToggle}
      showAbilityMethodTestToggle={showAbilityMethodTestToggle}
      showProseEditTestToggle={showProseEditTestToggle}
    />
  )
}

function CharacterBuilderTestHarness({
  onResolve,
  payload,
  readOnly,
  resolveDebounceMs,
  showAncestrySelectionTestToggle,
  showAbilityMethodTestToggle,
  showProseEditTestToggle
}: {
  onResolve: (character: CharacterFormValues) => Promise<void> | void
  payload: CharacterBuilderPayloadDto
  readOnly: boolean
  resolveDebounceMs: number
  showAncestrySelectionTestToggle: boolean
  showAbilityMethodTestToggle: boolean
  showProseEditTestToggle: boolean
}) {
  const form = useAppForm({
    defaultValues: toCharacterFormValues(payload),
    onSubmit: async () => undefined
  })
  const hostedForm = useMemo<AuthoringHostedForm>(() => {
    const progress = getCharacterBuilderProgressState(payload, toCharacterFormValues(payload))
    return {
      actions: {
        onActivate: () => form.handleSubmit(),
        onSaveDraft: () => undefined
      },
      cancelHref: '/characters',
      labels: {
        activateLabel: 'Activate',
        canDelete: false,
        canSaveDraft: !readOnly,
        deleteLabel: 'Discard draft',
        hasActiveDraft: false,
        isDraft: false,
        mode: readOnly ? 'view' : 'edit',
        readOnly,
        saveDraftLabel: 'Save Draft',
        subjectKindLabel: 'Character',
        subjectLabel: payload.character.label || 'Untitled Character',
        systemId: payload.character.systemId
      },
      navigation: {
        isComplete: false,
        progressSummary: progress.progressSummary,
        stepStatuses: progress.stepStatuses,
        visibleSteps: characterBuilderVisibleSteps
      },
      status: {
        canFinalize: false,
        canResetForm: false,
        canResetStep: false,
        canSubmit: false,
        hasChanges: false,
        hasStepChanges: false,
        isSubmitting: false
      }
    }
  }, [form, payload, readOnly])

  return (
    <form.AppForm>
      <AuthoringFormProvider hostedForm={hostedForm}>
        <AuthoringLayoutContent>
          {showAbilityMethodTestToggle ? (
            <button
              type='button'
              onClick={() => {
                form.setFieldValue('intent.abilities', {
                  method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
                  state: {
                    assignments: [],
                    rollGroups: []
                  }
                })
              }}
            >
              Set Manual Ability Method
            </button>
          ) : null}
          {showAncestrySelectionTestToggle ? (
            <button
              type='button'
              onClick={() => {
                form.setFieldValue('intent.ancestrySelections', [
                  {
                    id: 'ancestry-choice-forest',
                    ancestryId: 'ancestry-elf',
                    optionId: 'ancestry-forest',
                    source: {
                      kind: 'SUBRACE',
                      subraceId: 'subrace-sea-elf'
                    },
                    timing: {
                      kind: 'IMMEDIATE'
                    }
                  }
                ])
              }}
            >
              Set Forest Ancestry
            </button>
          ) : null}
          {showProseEditTestToggle ? (
            <button
              type='button'
              onClick={() => form.setFieldValue('profile.notes', 'Updated table notes.')}
            >
              Update table notes
            </button>
          ) : null}
          <CharacterBuilderRenderer
            form={form}
            payload={payload}
            resolveDebounceMs={resolveDebounceMs}
            onResolve={onResolve}
            onStepChange={() => undefined}
          />
          <form.Subscribe selector={(state) => state.isDirty}>
            {(isDirty) => (
              <output aria-label='builder dirty state' role='status'>
                {String(isDirty)}
              </output>
            )}
          </form.Subscribe>
          <CharacterBuilderStateProbe />
        </AuthoringLayoutContent>
      </AuthoringFormProvider>
    </form.AppForm>
  )
}

function CharacterBuilderStateProbe() {
  const { stepStatuses } = useAuthoringNavigation()
  return <output aria-label='builder step statuses'>{JSON.stringify(stepStatuses)}</output>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}
