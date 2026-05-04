import { render, screen } from '@testing-library/react'
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
import { TestRouterProvider } from '#test/TestRouterProvider'

type TestFormValues = {
  label: string
  category: string | undefined
  features: Record<string, unknown>[]
}

const testFormDefaults: TestFormValues = {
  label: '',
  category: undefined,
  features: []
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

const TestAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: testFormDefaults
})

function TestForm({
  onSubmit = vi.fn()
}: {
  onSubmit?: (value: TestFormValues) => void
}) {
  const form = useAppForm({
    defaultValues: testFormDefaults,
    onSubmit: async ({ value }) => onSubmit(value)
  })

  return (
    <form.AppForm>
      <AuthoringFormProvider>
        <TestFormContent form={form} />
      </AuthoringFormProvider>
    </form.AppForm>
  )
}

const TestFormContent = withForm({
  defaultValues: testFormDefaults,
  render: function TestFormContent({ form }) {
    useAuthoringFormRegistration({
      activateLabel: 'Submit',
      mapId: 'test-form',
      providedModel: resolvedModel,
      readOnly: false,
      resolveModel: false,
      subjectKindLabel: 'Test Form'
    }, {
      onActivate: () => form.handleSubmit()
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
    expect(screen.queryByRole('textbox', { name: /hidden text/i })).not.toBeInTheDocument()
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
