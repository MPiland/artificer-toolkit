import { useMemo } from 'react'
import type { Decorator, StoryObj } from '@storybook/tanstack-react'
import type {
  BackgroundAuthoringInputDto,
  BackgroundAuthoredDto
} from '@artificer-toolkit/schema/subjects/background'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  authoringFormStoryCanvas,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import {
  createEmptyBackground,
  normalizeBackgroundForSubmit
} from '../backgroundAuthoring.utils'
import { BackgroundAuthoringRenderer } from '../components/BackgroundAuthoringRenderer'
import {
  masterBackgroundFixture,
  ownedBackgroundFixture
} from '../background.fixtures'

interface BackgroundAuthoringStoryProps {
  initialBackground?: BackgroundAuthoringInputDto | BackgroundAuthoredDto
  readOnly?: boolean
}

function BackgroundAuthoringStory({
  initialBackground = createEmptyBackground({ systemId: 'dnd-5e-srd' }),
  readOnly = false
}: BackgroundAuthoringStoryProps) {
  return (
    <AuthoringFormProvider>
      <BackgroundAuthoringStoryContent initialBackground={initialBackground} readOnly={readOnly} />
    </AuthoringFormProvider>
  )
}

function BackgroundAuthoringStoryContent({
  initialBackground,
  readOnly
}: Required<BackgroundAuthoringStoryProps>) {
  const background = normalizeBackgroundForSubmit(initialBackground)
  const form = useAppForm({
    defaultValues: background,
    onSubmit: async ({ value }) => {
      normalizeBackgroundForSubmit(value)
    }
  })
  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Background',
    canCopy: readOnly,
    canSaveDraft: !readOnly,
    hasActiveDraft: false,
    mapId: 'background',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Background',
    subjectLabel: background.label || 'Untitled Background',
    systemId: background.systemId
  }), [
    background.label,
    background.systemId,
    readOnly
  ])
  const actions = useMemo<AuthoringFormActionHandlers>(() => ({
    onActivate: () => form.handleSubmit(),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: readOnly ? () => undefined : undefined,
    onSaveDraft: readOnly ? undefined : () => undefined
  }), [
    form,
    readOnly
  ])

  useAuthoringFormRegistration(registration, actions)

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <BackgroundAuthoringRenderer form={form} resolveModel={false} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

const authoringCanvasDecorator: Decorator = (Story) => (
  <div className={authoringFormStoryCanvas}>
    <Story />
  </div>
)

const meta = {
  title: 'Domains/Backgrounds/Authoring',
  component: BackgroundAuthoringStory,
  parameters: {
    docs: {
      description: {
        component: 'Background authoring rendered through the shared node-driven TanStack renderer.'
      }
    }
  },
  decorators: [authoringCanvasDecorator]
}

export default meta

type Story = StoryObj<BackgroundAuthoringStoryProps>

export const Create: Story = {}

export const EditOwned: Story = {
  args: {
    initialBackground: ownedBackgroundFixture
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    initialBackground: masterBackgroundFixture,
    readOnly: true
  }
}
