import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useMemo } from 'react'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import {
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE
} from '@artificer-toolkit/shared/core'
import { useAppForm } from '#forms/app-form/AppForm'
import { AuthoringLayout } from '#forms/layout/AuthoringLayout'
import {
  useAuthoringForm,
  type AuthoringFormStatePatch
} from '#forms/layout/AuthoringFormContext'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import {
  characterBuilderDraftPayloadFixture,
  characterBuilderPayloadFixture
} from '../character.fixtures'
import {
  createStartingEquipmentDecision,
  toCharacterFormValues,
  type CharacterFormValues
} from '../characterBuilder.utils'
import { CharacterBuilderRenderer } from '../components/CharacterBuilderRenderer'

describe('CharacterBuilderRenderer', () => {
  it('renders the recommended builder step and navigates through steps', async () => {
    const user = userEvent.setup()

    renderCharacterBuilderHarness({ payload: characterBuilderPayloadFixture })

    expect(screen.getByRole('heading', { level: 2, name: /basics/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /character name/i })).toHaveValue('Astra Vale')

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('heading', { level: 2, name: /race/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /^race$/i })).toBeInTheDocument()
  })

  it('uses draft readiness from the backend view to keep finalize unavailable', async () => {
    const user = userEvent.setup()

    renderCharacterBuilderHarness({ payload: characterBuilderDraftPayloadFixture })

    for (let index = 0; index < 8; index += 1) {
      const nextButton = screen.queryByRole('button', { name: /next/i })
      if (!nextButton) break
      await user.click(nextButton)
    }

    expect(screen.getByText(/needs attention/i)).toBeInTheDocument()
    expect(screen.getByText(/choose a race/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finalize character/i })).toBeDisabled()
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

    await user.click(screen.getByRole('combobox', { name: /^add class$/i }))
    fireEvent.click(await screen.findByRole('option', { hidden: true, name: 'Wizard' }))

    await user.click(screen.getByRole('button', { name: /^add class$/i }))

    expect(screen.getByRole('combobox', { name: /^class$/i })).toHaveValue('Wizard')
    expect(screen.getByText('Level 1')).toBeInTheDocument()
    await waitFor(() => {
      expect(resolvedValues.at(-1)?.intent.classes).toEqual([
        {
          classId: 'class-wizard',
          classLevel: 1
        }
      ])
    })
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
    expect(screen.getByText(/wizard starting equipment/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /group 1/i })).toBeInTheDocument()
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
                requiredCount: 1,
                selectedOptionIds: [],
                options: [
                  { id: 'option-perception', label: 'Perception' },
                  { id: 'option-stealth', label: 'Stealth' }
                ]
              }
            ]
          }
        }
      }
    })

    expect(screen.getByRole('heading', { level: 2, name: /race/i })).toBeInTheDocument()
    expect(screen.getByText(/choose one practiced elven skill/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /elven training choice/i })).toBeInTheDocument()
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

    expect(screen.getByRole('combobox', { name: /^race$/i })).toHaveValue('Dragonborn')
    expect(screen.getByRole('combobox', { name: /draconic ancestry/i })).toBeInTheDocument()
    expect(screen.getByText(/choose one type of dragon/i)).toBeInTheDocument()
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
                source: { kind: 'ANCESTRY', ancestryId: 'ancestry-draconic', optionId: 'ancestry-red' }
              },
              {
                id: 'feature-damage-resistance',
                label: 'Damage Resistance',
                description: '<p>You have resistance to fire damage.</p>',
                sourceLabel: 'Red (Fire)',
                source: { kind: 'ANCESTRY', ancestryId: 'ancestry-draconic', optionId: 'ancestry-red' }
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

    expect(screen.getByRole('combobox', { name: /arcane training choice/i })).toHaveValue('Arcana')
  })

  it('renders resolver-provided class spell choices on the class step', () => {
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
                    selectedCantripIds: [],
                    selectedSpellIds: [],
                    cantripOptions: [{ id: 'spell-mage-hand', label: 'Mage Hand' }],
                    spellOptions: [{ id: 'spell-magic-missile', label: 'Magic Missile' }]
                  }
                ]
              }
            ]
          }
        }
      }
    })

    expect(screen.getByRole('heading', { level: 2, name: /classes/i })).toBeInTheDocument()
    expect(screen.getByText(/spell choices/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /choose 1 cantrip/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /choose 1 spell/i })).toBeInTheDocument()
  })

  it('keeps class-owned spell choices selected when only class level changes', () => {
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
                    selectedCantripIds: ['spell-mage-hand'],
                    selectedSpellIds: [],
                    cantripOptions: [{ id: 'spell-mage-hand', label: 'Mage Hand' }],
                    spellOptions: []
                  }
                ]
              }
            ]
          }
        }
      }
    })

    expect(screen.getAllByText(/mage hand/i)).toHaveLength(2)
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
      .getAllByLabelText(/class level/i)
      .find((element) => element instanceof HTMLInputElement)
    expect(classLevelInput).toBeDefined()

    fireEvent.change(classLevelInput as HTMLInputElement, { target: { value: '1.5' } })

    await waitFor(() => {
      expect(resolvedValues.at(-1)?.intent.classes[0]?.classLevel).toBe(1)
    })
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

    expect(screen.queryByText(/manual roll provenance is preserved/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /set manual ability method/i }))

    expect(screen.getByText(/manual roll provenance is preserved/i)).toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: /set forest ancestry/i }))

    expect(screen.getByRole('combobox', { name: /elven lineage/i })).toHaveValue('Forest')
  })

  it('renders hit point entries from fixed character options without placeholder totals', async () => {
    const user = userEvent.setup()

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

    expect(screen.getByText(/fixed hp records the fixed total/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add missing levels/i }))

    expect(await screen.findByRole('textbox', { name: /fixed hp total/i })).toHaveValue('7')
  })

  it('adds later hit point levels from class hit dice and ability modifiers', async () => {
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

    await user.click(screen.getByRole('button', { name: /add missing levels/i }))

    const hitpointInputs = await screen.findAllByRole('textbox', { name: /fixed hp total/i })
    expect(hitpointInputs.map((input) => (input as HTMLInputElement).value)).toEqual(['7', '5'])
  })

  it('labels manual hit points as rolled totals', () => {
    renderCharacterBuilderHarness({
      payload: {
        ...characterBuilderPayloadFixture,
        character: {
          ...characterBuilderPayloadFixture.character,
          intent: {
            ...characterBuilderPayloadFixture.character.intent,
            hitpoints: {
              method: HITPOINT_CALCULATION_METHOD_CODE.MANUAL,
              levels: [{ level: 1, value: 7 }]
            }
          }
        },
        resolution: {
          ...characterBuilderPayloadFixture.resolution,
          recommendedSectionId: 'ABILITIES'
        }
      }
    })

    expect(screen.getByText(/manual hp records the rolled total/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /rolled hp total/i })).toHaveValue('7')
  })

  it('renders read-only builder fields when the authoring state is read-only', () => {
    renderCharacterBuilderHarness({
      payload: characterBuilderPayloadFixture,
      readOnly: true
    })

    expect(screen.getByRole('textbox', { name: /character name/i })).toHaveAttribute('readonly')
  })
})

function renderCharacterBuilderHarness({
  payload,
  readOnly = false,
  showAbilityMethodTestToggle = false,
  showAncestrySelectionTestToggle = false,
  resolveDebounceMs = 60_000,
  onResolve = () => undefined
}: {
  payload: CharacterBuilderPayloadDto
  readOnly?: boolean
  showAbilityMethodTestToggle?: boolean
  showAncestrySelectionTestToggle?: boolean
  resolveDebounceMs?: number
  onResolve?: (character: CharacterFormValues) => Promise<void> | void
}) {
  return renderWithAppProviders(
    <AuthoringLayout>
      <CharacterBuilderTestHarness
        onResolve={onResolve}
        payload={payload}
        readOnly={readOnly}
        resolveDebounceMs={resolveDebounceMs}
        showAncestrySelectionTestToggle={showAncestrySelectionTestToggle}
        showAbilityMethodTestToggle={showAbilityMethodTestToggle}
      />
    </AuthoringLayout>
  )
}

function CharacterBuilderTestHarness({
  onResolve,
  payload,
  readOnly,
  resolveDebounceMs,
  showAncestrySelectionTestToggle,
  showAbilityMethodTestToggle
}: {
  onResolve: (character: CharacterFormValues) => Promise<void> | void
  payload: CharacterBuilderPayloadDto
  readOnly: boolean
  resolveDebounceMs: number
  showAncestrySelectionTestToggle: boolean
  showAbilityMethodTestToggle: boolean
}) {
  const {
    updateAuthoringFormActions,
    updateAuthoringFormState
  } = useAuthoringForm()
  const form = useAppForm({
    defaultValues: toCharacterFormValues(payload),
    onSubmit: async () => undefined
  })

  const statePatch = useMemo<AuthoringFormStatePatch>(
    () => ({
      activateLabel: 'Finalize Character',
      authoringKind: 'character-builder',
      canSaveDraft: !readOnly,
      mode: readOnly ? 'view' : 'edit',
      readOnly,
      saveDraftLabel: 'Save Draft',
      subjectKindLabel: 'Character',
      subjectLabel: payload.character.label || 'Untitled Character',
      systemId: payload.character.systemId
    }),
    [payload.character.label, payload.character.systemId, readOnly]
  )
  const actions = useMemo(
    () => ({
      onActivate: () => form.handleSubmit(),
      onSaveDraft: () => undefined
    }),
    [form]
  )

  useEffect(() => {
    updateAuthoringFormState(statePatch)
  }, [statePatch, updateAuthoringFormState])

  useEffect(() => {
    updateAuthoringFormActions(actions)
  }, [actions, updateAuthoringFormActions])

  return (
    <form.AppForm>
      {showAbilityMethodTestToggle ? (
        <button
          type='button'
          onClick={() => {
            form.setFieldValue('intent.abilities', {
              method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
              assignments: [],
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
      <CharacterBuilderRenderer
        form={form}
        payload={payload}
        resolveDebounceMs={resolveDebounceMs}
        onResolve={onResolve}
      />
    </form.AppForm>
  )
}
