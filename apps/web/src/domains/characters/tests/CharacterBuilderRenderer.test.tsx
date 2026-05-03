import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
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
  readOnly = false
}: {
  payload: CharacterBuilderPayloadDto
  readOnly?: boolean
}) {
  return renderWithAppProviders(
    <AuthoringFormProvider>
      <CharacterBuilderTestHarness
        payload={payload}
        readOnly={readOnly}
      />
    </AuthoringFormProvider>
  )
}

function CharacterBuilderTestHarness({
  payload,
  readOnly
}: {
  payload: CharacterBuilderPayloadDto
  readOnly: boolean
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
        <CharacterBuilderRenderer
          form={form}
          payload={payload}
          resolveDebounceMs={60_000}
          onResolve={(_: CharacterFormValues) => undefined}
        />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}
