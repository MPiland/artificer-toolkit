import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'
import type {
  CharacterBuilderPayloadDto,
  CharacterBuilderPreviewPayloadDto
} from '@artificer-toolkit/schema/api/characters'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import {
  characterBuilderDraftPayloadFixture,
  characterBuilderPayloadFixture,
  characterPreviewFixture
} from '../character.fixtures'
import {
  type CharacterBuilderStepId,
  toCharacterFormValues,
  type CharacterFormValues
} from '../characterBuilder.utils'
import { CharacterBuilderRenderer } from '../components/CharacterBuilderRenderer'
import { CharacterSavePreviewModal } from '../components/CharacterSavePreviewModal'

const meta = {
  title: 'Domains/Characters/Builder',
  component: CharacterBuilderStoryHarness,
  parameters: {
    docs: {
      description: {
        component: 'Character Builder shell with custom step orchestration, backend resolver view data, draft readiness, and final-save preview behavior.'
      }
    }
  }
} satisfies Meta<typeof CharacterBuilderStoryHarness>

export default meta

type Story = StoryObj<typeof meta>

export const EditReadyCharacter: Story = {
  args: {
    payload: characterBuilderPayloadFixture,
    readOnly: false
  }
}

export const CreateDraftWithBlockers: Story = {
  args: {
    payload: characterBuilderDraftPayloadFixture,
    readOnly: false
  }
}

export const ReadOnlyPreview: Story = {
  args: {
    payload: characterBuilderPayloadFixture,
    readOnly: true
  }
}

export const RaceStep: Story = {
  args: {
    payload: withRecommendedStep(characterBuilderPayloadFixture, 'RACE'),
    readOnly: false
  }
}

export const ClassChoicesStep: Story = {
  args: {
    payload: withClassChoiceViews(withRecommendedStep(characterBuilderPayloadFixture, 'CLASSES')),
    readOnly: false
  }
}

export const BackgroundChoicesStep: Story = {
  args: {
    payload: withBackgroundChoiceViews(withRecommendedStep(characterBuilderPayloadFixture, 'BACKGROUND')),
    readOnly: false
  }
}

export const ManualAbilityStep: Story = {
  args: {
    payload: withManualAbilityMethod(withRecommendedStep(characterBuilderPayloadFixture, 'ABILITIES')),
    readOnly: false
  }
}

export const StartingEquipmentStep: Story = {
  args: {
    payload: withStartingEquipmentViews(withRecommendedStep(characterBuilderPayloadFixture, 'EQUIPMENT')),
    readOnly: false
  }
}

export const BlockedReviewStep: Story = {
  args: {
    payload: withRecommendedStep(characterBuilderDraftPayloadFixture, 'REVIEW'),
    readOnly: false
  }
}

export const SavePreviewModal: Story = {
  args: {
    payload: characterBuilderPayloadFixture,
    preview: characterPreviewFixture,
    previewInitiallyOpened: true,
    readOnly: false
  }
}

function CharacterBuilderStoryHarness({
  payload,
  preview = null,
  previewInitiallyOpened = false,
  readOnly
}: {
  payload: CharacterBuilderPayloadDto
  preview?: CharacterBuilderPreviewPayloadDto | null
  previewInitiallyOpened?: boolean
  readOnly: boolean
}) {
  return (
    <AuthoringFormProvider>
      <CharacterBuilderStoryInner
        payload={payload}
        preview={preview}
        previewInitiallyOpened={previewInitiallyOpened}
        readOnly={readOnly}
      />
    </AuthoringFormProvider>
  )
}

function CharacterBuilderStoryInner({
  payload,
  preview,
  previewInitiallyOpened,
  readOnly
}: {
  payload: CharacterBuilderPayloadDto
  preview: CharacterBuilderPreviewPayloadDto | null
  previewInitiallyOpened: boolean
  readOnly: boolean
}) {
  const [currentPayload, setCurrentPayload] = useState(payload)
  const [previewOpened, setPreviewOpened] = useState(previewInitiallyOpened)
  const form = useAppForm({
    defaultValues: toCharacterFormValues(payload),
    onSubmit: async () => {
      setPreviewOpened(true)
    }
  })

  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Finalize Character',
    canSaveDraft: !readOnly,
    hasActiveDraft: currentPayload.character.status === 'DRAFT',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Character',
    subjectLabel: currentPayload.character.label || 'Untitled Character',
    systemId: currentPayload.character.systemId
  }), [
    currentPayload.character.label,
    currentPayload.character.status,
    currentPayload.character.systemId,
    readOnly
  ])

  const actions = useMemo<AuthoringFormActionHandlers>(() => ({
    onActivate: () => form.handleSubmit(),
    onCancel: () => undefined,
    onSaveDraft: () => undefined
  }), [form])

  useAuthoringFormRegistration(registration, actions)

  function handleResolve(character: CharacterFormValues) {
    setCurrentPayload((existing) => ({
      ...existing,
      character: {
        ...existing.character,
        label: character.label
      }
    }))
  }

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <CharacterBuilderRenderer
          form={form}
          payload={currentPayload}
          resolveDebounceMs={60_000}
          onResolve={handleResolve}
        />
      </AuthoringFormLayout>
      <CharacterSavePreviewModal
        isCommitting={false}
        opened={previewOpened}
        preview={preview}
        onClose={() => setPreviewOpened(false)}
        onConfirm={() => setPreviewOpened(false)}
      />
    </form.AppForm>
  )
}

function withRecommendedStep(
  payload: CharacterBuilderPayloadDto,
  recommendedSectionId: CharacterBuilderStepId
): CharacterBuilderPayloadDto {
  return {
    ...payload,
    resolution: {
      ...payload.resolution,
      recommendedSectionId
    }
  }
}

function withClassChoiceViews(payload: CharacterBuilderPayloadDto): CharacterBuilderPayloadDto {
  return {
    ...payload,
    character: {
      ...payload.character,
      intent: {
        ...payload.character.intent,
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
        ],
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
    view: {
      ...payload.view,
      classes: {
        ...payload.view.classes,
        selectedClasses: [
          {
            ...payload.view.classes.selectedClasses[0],
            featureChoices: [
              {
                featureId: 'feature-arcane-training',
                featureLabel: 'Arcane Training',
                sourceLabel: 'Wizard',
                source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
                selectionKey: 'options',
                requiredCount: 1,
                selectedOptionIds: ['option-arcana'],
                options: [
                  { id: 'option-arcana', label: 'Arcana' },
                  { id: 'option-history', label: 'History' }
                ]
              }
            ],
            spellChoices: [
              {
                id: 'class-wizard:spellcasting',
                label: 'Wizard Spellcasting',
                sourceLabel: 'Wizard',
                source: { kind: 'CLASS', classId: 'class-wizard', classLevel: 1 },
                cantripLimit: 1,
                learnedSpellLimit: 1,
                selectedCantripIds: ['spell-mage-hand'],
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
}

function withBackgroundChoiceViews(payload: CharacterBuilderPayloadDto): CharacterBuilderPayloadDto {
  return {
    ...payload,
    view: {
      ...payload.view,
      background: {
        ...payload.view.background,
        featureChoices: [
          {
            featureId: 'feature-sage-specialty',
            featureLabel: 'Research Specialty',
            sourceLabel: 'Sage',
            source: { kind: 'BACKGROUND', backgroundId: 'background-sage' },
            selectionKey: 'options',
            requiredCount: 1,
            selectedOptionIds: [],
            options: [
              { id: 'option-arcane-lore', label: 'Arcane Lore' },
              { id: 'option-historical-records', label: 'Historical Records' }
            ]
          }
        ]
      }
    }
  }
}

function withManualAbilityMethod(payload: CharacterBuilderPayloadDto): CharacterBuilderPayloadDto {
  return {
    ...payload,
    character: {
      ...payload.character,
      intent: {
        ...payload.character.intent,
        abilities: {
          method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
          state: {
            assignments: [{ ability: 'STRENGTH', score: 16 }],
            rollGroups: []
          }
        }
      }
    }
  }
}

function withStartingEquipmentViews(payload: CharacterBuilderPayloadDto): CharacterBuilderPayloadDto {
  return {
    ...payload,
    view: {
      ...payload.view,
      equipment: {
        ...payload.view.equipment,
        classStartingEquipmentRequired: true,
        backgroundStartingEquipmentRequired: true,
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
        },
        backgroundStartingEquipment: {
          source: 'BACKGROUND',
          sourceLabel: 'Sage',
          startingEquipment: {
            id: 'sage-starting-equipment',
            sets: [
              {
                id: 'sage-set',
                order: 1,
                groups: [
                  {
                    id: 'sage-group',
                    order: 1,
                    options: [
                      {
                        id: 'sage-option',
                        order: 1,
                        items: [
                          {
                            id: 'sage-gold',
                            order: 1,
                            startingEquipmentKind: 'CURRENCY',
                            currencies: [{ amount: 10, currencyId: 'gp' }]
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
}
