import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  useAppForm,
  useAuthoringFormRegistration
} from '#forms'
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
    expect(screen.getByRole('textbox', { name: /^race$/i })).toBeInTheDocument()
  })

  it('uses draft readiness from the backend view to keep finalize unavailable', async () => {
    const user = userEvent.setup()

    renderCharacterBuilderHarness({ payload: characterBuilderDraftPayloadFixture })

    await user.click(screen.getByRole('button', { name: /review/i }))

    expect(screen.getByText(/needs attention/i)).toBeInTheDocument()
    expect(screen.getByText(/choose a race/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finalize character/i })).toBeDisabled()
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
    expect(screen.getByRole('textbox', { name: /group 1/i })).toBeInTheDocument()
  })

  it('renders resolver-provided source-local feature choices on the owning step', () => {
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
    expect(screen.getByText(/feature choices/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /elven training choice/i })).toBeInTheDocument()
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

    expect(screen.getByRole('textbox', { name: /arcane training choice/i })).toHaveValue('Arcana')
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
    expect(screen.getByRole('textbox', { name: /choose 1 cantrip/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /choose 1 spell/i })).toBeInTheDocument()
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
    expect(latestValues?.intent.featureAcquisitions.map((acquisition) => acquisition.id)).toEqual(['background-feature-choice'])
    expect(latestValues?.intent.spellSelections).toBeUndefined()
    expect(latestValues?.intent.resourceGrants).toBeUndefined()
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
  resolveDebounceMs = 60_000,
  onResolve = () => undefined
}: {
  payload: CharacterBuilderPayloadDto
  readOnly?: boolean
  showAbilityMethodTestToggle?: boolean
  resolveDebounceMs?: number
  onResolve?: (character: CharacterFormValues) => Promise<void> | void
}) {
  return renderWithAppProviders(
    <AuthoringFormProvider>
      <CharacterBuilderTestHarness
        onResolve={onResolve}
        payload={payload}
        readOnly={readOnly}
        resolveDebounceMs={resolveDebounceMs}
        showAbilityMethodTestToggle={showAbilityMethodTestToggle}
      />
    </AuthoringFormProvider>
  )
}

function CharacterBuilderTestHarness({
  onResolve,
  payload,
  readOnly,
  resolveDebounceMs,
  showAbilityMethodTestToggle
}: {
  onResolve: (character: CharacterFormValues) => Promise<void> | void
  payload: CharacterBuilderPayloadDto
  readOnly: boolean
  resolveDebounceMs: number
  showAbilityMethodTestToggle: boolean
}) {
  const form = useAppForm({
    defaultValues: toCharacterFormValues(payload),
    onSubmit: async () => undefined
  })

  useAuthoringFormRegistration({
    activateLabel: 'Finalize Character',
    canSaveDraft: !readOnly,
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Character',
    subjectLabel: payload.character.label || 'Untitled Character',
    systemId: payload.character.systemId
  }, {
    onActivate: () => form.handleSubmit(),
    onSaveDraft: () => undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        {showAbilityMethodTestToggle
          ? (
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
            )
          : null}
        <CharacterBuilderRenderer
          form={form}
          payload={payload}
          resolveDebounceMs={resolveDebounceMs}
          onResolve={onResolve}
        />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}
