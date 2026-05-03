import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characters'
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
  characterBuilderPayloadFixture
} from '../character.fixtures'
import {
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

function CharacterBuilderStoryHarness({
  payload,
  readOnly
}: {
  payload: CharacterBuilderPayloadDto
  readOnly: boolean
}) {
  return (
    <AuthoringFormProvider>
      <CharacterBuilderStoryInner
        payload={payload}
        readOnly={readOnly}
      />
    </AuthoringFormProvider>
  )
}

function CharacterBuilderStoryInner({
  payload,
  readOnly
}: {
  payload: CharacterBuilderPayloadDto
  readOnly: boolean
}) {
  const [currentPayload, setCurrentPayload] = useState(payload)
  const [previewOpened, setPreviewOpened] = useState(false)
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
        preview={null}
        onClose={() => setPreviewOpened(false)}
        onConfirm={() => setPreviewOpened(false)}
      />
    </form.AppForm>
  )
}
