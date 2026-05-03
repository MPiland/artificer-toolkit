import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  createAuthoringFormRenderer,
  getResolvedNodeOptions,
  getResolvedNodeRequired,
  getResolvedNodeVisible,
  useAppForm,
  useAuthoringFormRegistration,
  withForm
} from '#forms'
import { TestRouterProvider } from '#test/TestRouterProvider'

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
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const TestAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: {
    label: '',
    category: undefined as string | undefined
  },
  groupDefaultValues: {},
  createArrayItem: (_node, currentLength) => ({
    id: crypto.randomUUID(),
    order: currentLength + 1
  }),
  createObjectItem: () => ({})
})

function TestForm({
  onSubmit = vi.fn()
}: {
  onSubmit?: (value: { label: string, category?: string }) => void
}) {
  const form = useAppForm({
    defaultValues: {
      label: '',
      category: undefined as string | undefined
    },
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
  defaultValues: {
    label: '',
    category: undefined as string | undefined
  },
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
})
