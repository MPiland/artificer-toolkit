import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  createAuthoringFormRenderer,
  createDefaultAuthoringArrayItem,
  createDefaultAuthoringObjectItem,
  getResolvedNodeOptions,
  getResolvedNodeRequired,
  getResolvedNodeVisible,
  useAppForm,
  useAuthoringFormRegistration,
  withForm
} from '#forms'
import { AppShellFrame, platformNavigation } from '#app/shell'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { wideField } from '../components/formStyles.css'

type TestFormValues = {
  id: string
  label: string
  order: number
  quote: string
  description: string
  effects: Record<string, unknown>[]
  grants?: Record<string, unknown>
  charges?: Record<string, unknown>
  restrictions?: Record<string, unknown>
  notes: string
  category: string | undefined
  features: Record<string, unknown>[]
  paths: Record<string, unknown>[]
  systemId: string
  userId?: string
}

const testFormDefaults: TestFormValues = {
  id: 'test-form-1',
  label: '',
  order: 1,
  quote: '',
  description: '',
  effects: [
    {
      id: 'effect-1',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED',
        activation: { code: 'ACTION', amount: 1 },
        range: { rangeKind: 'SELF' }
      },
      paths: [
        {
          id: 'path-1',
          order: 1,
          pathCode: 'ON_SAVE_FAIL',
          selectionKind: 'FIXED',
          rangeOverride: { rangeKind: 'SELF' },
          resultBlock: {
            id: 'result-1',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'outcome-1',
                effectKind: 'DAMAGE',
                valueKind: 'DICE',
                scalingKind: 'NONE',
                diceConfig: '2d6',
                damageTypeId: 'acid'
              }
            ]
          }
        }
      ]
    }
  ],
  notes: '',
  category: undefined,
  features: [],
  grants: undefined,
  charges: undefined,
  restrictions: {
    id: 'restrictions-1',
    groups: []
  },
  paths: [
    {
      id: 'path-1',
      order: 1,
      pathCode: 'ON_SAVE_FAIL',
      selectionKind: 'FIXED'
    }
  ],
  systemId: 'system-1',
  userId: 'user-1'
}

const resolvedModel = {
  mapId: 'test-form',
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
              id: 'id',
              path: ['id'],
              label: 'ID',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: true,
              clearPaths: []
            },
            {
              id: 'userId',
              path: ['userId'],
              label: 'User ID',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: false,
              clearPaths: []
            },
            {
              id: 'systemId',
              path: ['systemId'],
              label: 'System ID',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: true,
              clearPaths: []
            },
            {
              id: 'label',
              path: ['label'],
              label: 'Name',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: true,
              clearPaths: []
            },
            {
              id: 'order',
              path: ['order'],
              label: 'Order',
              kind: 'INPUT',
              type: 'NUMBER',
              visible: true,
              required: true,
              clearPaths: []
            },
            {
              id: 'quote',
              path: ['quote'],
              label: 'Quote',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: false,
              clearPaths: []
            },
            {
              id: 'description',
              path: ['description'],
              label: 'Description',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: false,
              clearPaths: []
            },
            {
              id: 'category',
              path: ['category'],
              label: 'Category',
              kind: 'INPUT',
              type: 'SELECT_SINGLE',
              visible: true,
              required: false,
              clearPaths: [],
              options: [{ value: 'spell', label: 'Spell' }]
            },
            {
              id: 'notes',
              path: ['notes'],
              label: 'Notes',
              kind: 'INPUT',
              type: 'RICH_TEXT',
              visible: true,
              required: false,
              clearPaths: []
            },
            {
              id: 'hiddenText',
              path: ['hiddenText'],
              label: 'Hidden Text',
              kind: 'INPUT',
              type: 'TEXT',
              visible: false,
              required: false,
              clearPaths: []
            },
            {
              id: 'features',
              path: ['features'],
              label: 'Features',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'feature',
              visible: true,
              required: false,
              clearPaths: []
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const multiStepResolvedModel = {
  ...resolvedModel,
  steps: [
    {
      ...resolvedModel.steps[0],
      sections: [
        {
          ...resolvedModel.steps[0].sections[0],
          nodes: resolvedModel.steps[0].sections[0].nodes.filter((node) => node.id === 'label')
        }
      ]
    },
    {
      id: 'details',
      label: 'Details',
      order: 20,
      sections: [
        {
          id: 'details',
          label: 'Details',
          order: 20,
          nodes: [
            {
              id: 'category',
              path: ['category'],
              label: 'Category',
              kind: 'INPUT',
              type: 'SELECT_SINGLE',
              visible: true,
              required: false,
              clearPaths: [],
              options: [{ value: 'spell', label: 'Spell' }]
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const outcomePathResolvedModel = {
  ...resolvedModel,
  steps: [
    {
      ...resolvedModel.steps[0],
      sections: [
        {
          ...resolvedModel.steps[0].sections[0],
          nodes: [
            {
              id: 'paths',
              path: ['paths'],
              label: 'Outcome Paths',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'effectPath',
              visible: true,
              required: false,
              clearPaths: []
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const effectResolvedModel = {
  ...resolvedModel,
  steps: [
    {
      ...resolvedModel.steps[0],
      sections: [
        {
          ...resolvedModel.steps[0].sections[0],
          nodes: [
            {
              id: 'effects',
              path: ['effects'],
              label: 'Effects',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'effect',
              visible: true,
              required: false,
              clearPaths: []
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const grantsResolvedModel = {
  ...resolvedModel,
  steps: [
    {
      ...resolvedModel.steps[0],
      sections: [
        {
          ...resolvedModel.steps[0].sections[0],
          nodes: [
            {
              id: 'grants',
              path: ['grants'],
              label: 'Grants',
              kind: 'GROUP',
              groupKind: 'OBJECT',
              childMapId: 'featureGrants',
              visible: true,
              required: false,
              clearPaths: []
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const mechanicsResolvedModel = {
  ...resolvedModel,
  steps: [
    {
      ...resolvedModel.steps[0],
      sections: [
        {
          id: 'effects',
          label: 'Effects',
          order: 10,
          nodes: [
            {
              id: 'effects',
              path: ['effects'],
              label: 'Effects',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'effect',
              visible: true,
              required: false,
              clearPaths: []
            }
          ]
        },
        {
          id: 'usage',
          label: 'Usage',
          order: 20,
          nodes: [
            {
              id: 'charges',
              path: ['charges'],
              label: 'Charges',
              kind: 'GROUP',
              groupKind: 'OBJECT',
              childMapId: 'charges',
              visible: true,
              required: false,
              clearPaths: []
            }
          ]
        },
        {
          id: 'restrictions',
          label: 'Restrictions',
          order: 30,
          nodes: [
            {
              id: 'restrictions',
              path: ['restrictions'],
              label: 'Restrictions',
              kind: 'GROUP',
              groupKind: 'OBJECT',
              childMapId: 'facet',
              visible: true,
              required: false,
              clearPaths: []
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const TestAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: testFormDefaults
})

function TestForm({
  canDelete = false,
  canSaveDraft = false,
  hasActiveDraft = false,
  isDraft = false,
  mode = 'edit',
  model = resolvedModel,
  onDelete,
  onSaveDraft,
  onSubmit = vi.fn()
}: {
  canDelete?: boolean
  canSaveDraft?: boolean
  hasActiveDraft?: boolean
  isDraft?: boolean
  mode?: 'create' | 'view' | 'edit'
  model?: NodeRuntimeResolveResponseDto
  onDelete?: () => void
  onSaveDraft?: () => void
  onSubmit?: (value: TestFormValues) => void
}) {
  const form = useAppForm({
    defaultValues: testFormDefaults,
    onSubmit: async ({ value }) => onSubmit(value)
  })

  return (
    <form.AppForm>
      <AuthoringFormProvider>
        <TestFormContent
          canDelete={canDelete}
          canSaveDraft={canSaveDraft}
          hasActiveDraft={hasActiveDraft}
          isDraft={isDraft}
          form={form}
          mode={mode}
          model={model}
          onDelete={onDelete}
          onSaveDraft={onSaveDraft}
        />
      </AuthoringFormProvider>
    </form.AppForm>
  )
}

const TestFormContent = withForm({
  defaultValues: testFormDefaults,
  props: {} as {
    canDelete: boolean
    canSaveDraft: boolean
    hasActiveDraft: boolean
    isDraft: boolean
    mode: 'create' | 'view' | 'edit'
    model: NodeRuntimeResolveResponseDto
    onDelete?: () => void
    onSaveDraft?: () => void
  },
  render: function TestFormContent({
    canDelete,
    canSaveDraft,
    hasActiveDraft,
    isDraft,
    form,
    mode,
    model,
    onDelete,
    onSaveDraft
  }) {
    useAuthoringFormRegistration({
      activateLabel: 'Submit',
      canDelete,
      canSaveDraft,
      hasActiveDraft,
      isDraft,
      mapId: 'test-form',
      mode,
      providedModel: model,
      readOnly: false,
      resolveModel: false,
      subjectKindLabel: 'Test Form'
    }, {
      onActivate: () => form.handleSubmit(),
      onDelete,
      onSaveDraft
    })

    return (
      <AuthoringFormLayout>
        <TestAuthoringRenderer form={form} />
      </AuthoringFormLayout>
    )
  }
})

describe('authoring form platform', () => {
  it('renders visible resolved fields and skips hidden fields', () => {
    render(
      <TestRouterProvider>
        <TestForm />
      </TestRouterProvider>
    )

    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /^id$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /order/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /user id/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /system id/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /hidden text/i })).not.toBeInTheDocument()
    const contentScroller = screen.getByTestId('authoring-form-content')
    const actionBar = screen.getByTestId('authoring-action-bar')
    expect(contentScroller).toBeInTheDocument()
    expect(actionBar).toBeInTheDocument()
    expect(contentScroller.contains(actionBar)).toBe(false)
    expect(contentScroller.parentElement).toBe(actionBar.parentElement)
  })

  it('renders rich text and prose fields as full-width rows', () => {
    render(
      <TestRouterProvider>
        <TestForm />
      </TestRouterProvider>
    )

    expect(screen.getByText('Quote').closest(`.${wideField}`)).not.toBeNull()
    expect(screen.getByText('Description').closest(`.${wideField}`)).not.toBeNull()
    expect(screen.getByText('Notes').closest(`.${wideField}`)).not.toBeNull()
  })

  it('shows form record status as a compact header chip', () => {
    const { rerender } = render(
      <TestRouterProvider>
        <TestForm />
      </TestRouterProvider>
    )

    expect(screen.getByLabelText(/current test form status: active/i)).toBeInTheDocument()

    rerender(
      <TestRouterProvider>
        <TestForm isDraft />
      </TestRouterProvider>
    )

    expect(screen.getByLabelText(/current test form status: draft/i)).toBeInTheDocument()
    expect(screen.queryByText(/the active test form stays unchanged/i)).not.toBeInTheDocument()

    rerender(
      <TestRouterProvider>
        <TestForm mode='create' />
      </TestRouterProvider>
    )

    expect(screen.getByLabelText(/current test form status: new draft/i)).toBeInTheDocument()
  })

  it('updates values through TanStack Form fields', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <TestRouterProvider>
        <TestForm onSubmit={onSubmit} />
      </TestRouterProvider>
    )

    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Fire Lace')
    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ label: 'Fire Lace' }))
  })

  it('shows registered delete actions in the header', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()

    render(
      <TestRouterProvider>
        <TestForm canDelete onDelete={onDelete} />
      </TestRouterProvider>
    )

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('enables save draft only after form changes', async () => {
    const user = userEvent.setup()
    const onSaveDraft = vi.fn()

    render(
      <TestRouterProvider>
        <TestForm canSaveDraft onSaveDraft={onSaveDraft} />
      </TestRouterProvider>
    )

    const saveDraftButton = screen.getByRole('button', { name: /save draft/i })
    expect(saveDraftButton).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Fire Lace')

    expect(saveDraftButton).toBeEnabled()
    await user.click(saveDraftButton)
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
  })

  it('uses selected outcome path labels for path rows', () => {
    render(
      <TestRouterProvider>
        <TestForm model={outcomePathResolvedModel} />
      </TestRouterProvider>
    )

    expect(screen.getByText('On Save Failure')).toBeInTheDocument()
    expect(screen.queryByText('Outcome Path 1')).not.toBeInTheDocument()
  })

  it('keeps nested editors open when editing an outcome path range override', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <TestRouterProvider>
        <TestForm model={outcomePathResolvedModel} onSubmit={onSubmit} />
      </TestRouterProvider>
    )

    await user.click(screen.getByRole('button', { name: /edit on save failure/i }))
    await user.click(screen.getByRole('button', { name: /edit range override/i }))

    const editorLocation = screen.getAllByRole('navigation', { name: /editor location/i }).at(-1)
    expect(editorLocation).toHaveTextContent('Outcome Paths')
    expect(editorLocation).toHaveTextContent('On Save Failure')
    expect(editorLocation).toHaveTextContent('Range Override')
    expect(screen.getAllByRole('combobox', { name: /range kind/i }).length).toBeGreaterThan(0)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders effect-owned child groups inline inside the effect editor', async () => {
    const user = userEvent.setup()
    const onSaveDraft = vi.fn()

    render(
      <TestRouterProvider>
        <TestForm canSaveDraft model={effectResolvedModel} onSaveDraft={onSaveDraft} />
      </TestRouterProvider>
    )

    const saveDraftButton = screen.getByRole('button', { name: /save draft/i })
    expect(saveDraftButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /edit activated/i }))

    expect(screen.getByRole('navigation', { name: /editor location/i })).toHaveTextContent('Effects')
    expect(screen.getByText('Failed: Damage')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^on save failure$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit range override/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^on save failure$/i }))
    await user.click(screen.getByRole('button', { name: /^range override$/i }))

    expect(screen.getAllByRole('combobox', { name: /range kind/i }).length).toBeGreaterThan(0)
    expect(screen.getByText('Outcomes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /result.*damage/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove activation/i })).not.toBeInTheDocument()
    expect(saveDraftButton).toBeDisabled()
  })

  it('removes effect-owned optional sections without closing the effect editor', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider>
        <TestForm model={effectResolvedModel} />
      </TestRouterProvider>
    )

    await user.click(screen.getByRole('button', { name: /edit activated/i }))
    await user.click(screen.getByRole('button', { name: /^on save failure$/i }))
    await user.click(screen.getByRole('button', { name: /remove range override/i }))

    expect(screen.getByRole('navigation', { name: /editor location/i })).toHaveTextContent('Effects')
    expect(screen.getByRole('button', { name: /^on save failure$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove range override/i })).not.toBeInTheDocument()
  })

  it('shows absent charges and empty restrictions as add actions only', () => {
    render(
      <TestRouterProvider>
        <TestForm model={mechanicsResolvedModel} />
      </TestRouterProvider>
    )

    expect(screen.getByRole('button', { name: /^add charges$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^add restrictions$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit charges/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit restrictions/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove restrictions/i })).not.toBeInTheDocument()
    expect(screen.getAllByText(/^Effects$/)).toHaveLength(1)
  })

  it('renders feature grants inline with a single add grant menu', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider>
        <TestForm model={grantsResolvedModel} />
      </TestRouterProvider>
    )

    expect(screen.queryByRole('button', { name: /edit grants/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^add grant$/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /add modifier grant/i, hidden: true }))

    expect(screen.getByRole('button', { name: /^modifier grants$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit grants/i })).not.toBeInTheDocument()
  })

  it('resets only the current step fields', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider>
        <TestForm model={multiStepResolvedModel} />
      </TestRouterProvider>
    )

    const nameInput = screen.getByRole('textbox', { name: /name/i })
    const resetStepButton = screen.getByRole('button', { name: /reset step/i })

    expect(resetStepButton).toBeDisabled()

    await user.type(nameInput, 'Fire Lace')
    expect(resetStepButton).toBeEnabled()

    await user.click(resetStepButton)

    expect(nameInput).toHaveValue('')
    expect(resetStepButton).toBeDisabled()
  })

  it('uses the header step list for direct step navigation', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider>
        <AppShellFrame
          breadcrumbs={['Test Forms', 'Fire Lace', 'Edit']}
          currentPath='/forms/fire-lace/edit'
          navigation={platformNavigation}
        >
          <TestForm canSaveDraft model={multiStepResolvedModel} />
        </AppShellFrame>
      </TestRouterProvider>
    )

    const saveDraftButton = screen.getByRole('button', { name: /save draft/i })
    const breadcrumb = screen.getByLabelText('Current section')
    expect(within(breadcrumb).queryByText('Edit')).not.toBeInTheDocument()
    expect(within(breadcrumb).getByRole('navigation', { name: /test form steps/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument()
    expect(saveDraftButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /details/i }))

    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /name/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    expect(saveDraftButton).toBeDisabled()
  })

  it('reads resolved node helpers from step models', () => {
    expect(getResolvedNodeRequired(resolvedModel, 'label')).toBe(true)
    expect(getResolvedNodeVisible(resolvedModel, 'hiddenText')).toBe(false)
    expect(getResolvedNodeOptions(resolvedModel, 'category', [])).toEqual([{ value: 'spell', label: 'Spell' }])
  })

  it('creates nested defaults from child map ids', () => {
    const featureNode = resolvedModel.steps[0].sections[0].nodes.find((node) => node.id === 'features')

    expect(featureNode).toBeDefined()
    expect(createDefaultAuthoringArrayItem(featureNode!, 0)).toEqual(expect.objectContaining({
      label: '',
      order: 1
    }))
    expect(createDefaultAuthoringObjectItem({
      id: 'cost',
      path: ['cost'],
      label: 'Cost',
      kind: 'GROUP',
      groupKind: 'OBJECT',
      childMapId: 'cost',
      visible: true,
      required: false,
      clearPaths: []
    })).toEqual({
      amount: 0,
      currencyId: ''
    })
  })
})
