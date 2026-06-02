import { useMemo } from 'react'
import type { Decorator, StoryObj } from '@storybook/tanstack-react'
import type {
  FeatAuthoringInputDto,
  FeatAuthoredDto
} from '@artificer-toolkit/schema/subjects/feat'
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
  createEmptyFeat,
  normalizeFeatForSubmit
} from '../featAuthoring.utils'
import { FeatAuthoringRenderer } from '../components/FeatAuthoringRenderer'
import {
  masterFeatFixture,
  ownedFeatFixture
} from '../feat.fixtures'

interface FeatAuthoringStoryProps {
  initialFeat?: FeatAuthoringInputDto | FeatAuthoredDto
  readOnly?: boolean
}

function FeatAuthoringStory({
  initialFeat = createEmptyFeat({ systemId: 'dnd-5e-srd' }),
  readOnly = false
}: FeatAuthoringStoryProps) {
  return (
    <AuthoringFormProvider>
      <FeatAuthoringStoryContent initialFeat={initialFeat} readOnly={readOnly} />
    </AuthoringFormProvider>
  )
}

function FeatAuthoringStoryContent({
  initialFeat,
  readOnly
}: Required<FeatAuthoringStoryProps>) {
  const feat = normalizeFeatForSubmit(initialFeat)
  const form = useAppForm({
    defaultValues: feat,
    onSubmit: async ({ value }) => {
      normalizeFeatForSubmit(value)
    }
  })
  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Feat',
    canCopy: readOnly,
    canSaveDraft: !readOnly,
    hasActiveDraft: false,
    mapId: 'feat',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Feat',
    subjectLabel: feat.label || 'Untitled Feat',
    systemId: feat.systemId
  }), [
    feat.label,
    feat.systemId,
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
        <FeatAuthoringRenderer form={form} resolveModel={false} />
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
  title: 'Domains/Feats/Authoring',
  component: FeatAuthoringStory,
  parameters: {
    docs: {
      description: {
        component: 'Feat authoring rendered through the shared node-driven TanStack renderer.'
      }
    }
  },
  decorators: [authoringCanvasDecorator]
}

export default meta

type Story = StoryObj<FeatAuthoringStoryProps>

export const Create: Story = {}

export const EditOwned: Story = {
  args: {
    initialFeat: ownedFeatFixture
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    initialFeat: masterFeatFixture,
    readOnly: true
  }
}
