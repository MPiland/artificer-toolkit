import type { Meta, StoryObj } from '@storybook/react-vite'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  authoringFormStoryCanvas,
  createAuthoringFormRenderer,
  useAppForm,
  useAuthoringFormRegistration,
  withForm
} from '#forms'

type PlatformFormValues = {
  castingTime?: string
  description?: string
  label: string
  notes?: { text?: string }[]
}

type PlatformFormStoryProps = {
  canCopy?: boolean
  copyLabel?: string
  defaultValues?: PlatformFormValues
  model?: NodeRuntimeResolveResponseDto
  readOnly?: boolean
}

const fieldPrimitivesModel = {
  mapId: 'storybook-form',
  clearPaths: [],
  steps: [
    {
      id: 'basics',
      label: 'Basics',
      order: 10,
      sections: [
        {
          id: 'identity',
          label: 'Identity',
          order: 10,
          nodes: [
            {
              id: 'label',
              path: ['label'],
              label: 'Name',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: true,
              readOnly: false,
              clearPaths: []
            },
            {
              id: 'description',
              path: ['description'],
              label: 'Rich Text Notes',
              kind: 'INPUT',
              type: 'RICH_TEXT',
              visible: true,
              required: false,
              readOnly: false,
              clearPaths: []
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const sectionedModel = {
  mapId: 'storybook-form',
  clearPaths: [],
  steps: [
    ...fieldPrimitivesModel.steps,
    {
      id: 'casting',
      label: 'Casting',
      order: 20,
      sections: [
        {
          id: 'casting',
          label: 'Casting',
          order: 10,
          nodes: [
            {
              id: 'castingTime',
              path: ['castingTime'],
              label: 'Casting Time',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: false,
              readOnly: false,
              clearPaths: []
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const nestedCollectionModel = {
  mapId: 'storybook-form',
  clearPaths: [],
  steps: [
    {
      id: 'notes',
      label: 'Notes',
      order: 10,
      sections: [
        {
          id: 'notes',
          label: 'Notes',
          order: 10,
          nodes: [
            {
              id: 'notes',
              path: ['notes'],
              label: 'note',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'storybook-note',
              visible: true,
              required: false,
              readOnly: false,
              clearPaths: []
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

function FormPlatformStory({
  canCopy = false,
  copyLabel,
  defaultValues = {
    label: 'Ember Ward',
    description: 'Use this field for formatted longform notes.',
    notes: [{ text: 'Useful for playtest encounters' }]
  },
  model = fieldPrimitivesModel,
  readOnly = false
}: PlatformFormStoryProps) {
  const form = useAppForm({
    defaultValues,
    onSubmit: async () => undefined
  })

  return (
    <form.AppForm>
      <AuthoringFormProvider>
        <FormPlatformContent
          canCopy={canCopy}
          copyLabel={copyLabel}
          form={form}
          model={model}
          readOnly={readOnly}
        />
      </AuthoringFormProvider>
    </form.AppForm>
  )
}

const formPlatformDefaults: PlatformFormValues = {
  label: '',
  description: '',
  notes: []
}

const FormPlatformRenderer = createAuthoringFormRenderer({
  defaultValues: formPlatformDefaults,
  groupDefaultValues: {},
  createArrayItem: (_node, currentLength) => ({
    id: crypto.randomUUID(),
    order: currentLength + 1
  }),
  createObjectItem: () => ({})
})

const FormPlatformContent = withForm({
  defaultValues: formPlatformDefaults,
  props: {
    canCopy: false,
    copyLabel: undefined as string | undefined,
    model: fieldPrimitivesModel,
    readOnly: false
  },
  render: function FormPlatformContent({
    canCopy,
    copyLabel,
    form,
    model,
    readOnly
  }) {
    useAuthoringFormRegistration({
      activateLabel: 'Submit',
      canCopy,
      copyLabel,
      mapId: model.mapId,
      mode: readOnly ? 'view' : 'edit',
      providedModel: model,
      readOnly,
      resolveModel: false,
      subjectKindLabel: 'Authoring Form',
      subjectLabel: form.state.values.label || 'Authoring Form'
    }, {
      onActivate: () => form.handleSubmit(),
      onCopy: () => undefined
    })

    return (
      <AuthoringFormLayout>
        <FormPlatformRenderer form={form} />
      </AuthoringFormLayout>
    )
  }
})

const meta = {
  title: 'Platform/Form',
  component: FormPlatformStory,
  decorators: [
    (Story) => (
      <div className={authoringFormStoryCanvas}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof FormPlatformStory>

export default meta

type Story = StoryObj<typeof meta>

export const FieldPrimitives: Story = {}

export const FieldPrimitivesReadonly: Story = {
  args: {
    readOnly: true
  }
}

export const SectionedNodeMap: Story = {
  args: {
    model: sectionedModel
  }
}

export const LockedMasterReadonly: Story = {
  args: {
    canCopy: true,
    copyLabel: 'Copy to edit',
    readOnly: true
  }
}

export const NestedCollection: Story = {
  args: {
    defaultValues: {
      label: 'Playtest Notes',
      notes: [{ text: 'Useful for playtest encounters' }]
    },
    model: nestedCollectionModel
  }
}

export const Default = FieldPrimitives
