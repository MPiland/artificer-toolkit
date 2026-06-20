import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useMemo } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useStore } from '@tanstack/react-form'
import type {
  NodeRuntimeNodeDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  AuthoringLayout,
  chooseInitialAuthoringFormValues,
  createDefaultAuthoringArrayItem,
  createDefaultAuthoringObjectItem,
  FormRenderer,
  useAppForm,
  useAuthoringForm,
  withForm
} from '#forms'
import { TestRouterProvider } from '#test/TestRouterProvider'

type TestFormValues = {
  category: string | undefined
  description: string
  id: string
  level: number
  name: string
  notes: string
  order: number
  systemId: string
}

const testDefaults: TestFormValues = {
  category: undefined,
  description: '',
  id: 'test-1',
  level: 1,
  name: '',
  notes: '',
  order: 1,
  systemId: 'system-1'
}

const testModel = {
  mapId: 'test-form-v2',
  clearPaths: [],
  steps: [
    {
      id: 'basics',
      label: 'Basics',
      order: 1,
      sections: [
        {
          id: 'basics-section',
          label: 'Basics',
          order: 1,
          nodes: [
            {
              id: 'id',
              path: ['id'],
              label: 'Id',
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
              id: 'name',
              path: ['name'],
              label: 'Name',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: true,
              clearPaths: []
            },
            {
              id: 'level',
              path: ['level'],
              label: 'Level',
              kind: 'INPUT',
              type: 'NUMBER',
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
              options: [{ value: 'spell', label: 'Spell' }],
              clearPaths: []
            },
            {
              id: 'description',
              path: ['description'],
              label: 'Description',
              kind: 'INPUT',
              type: 'RICH_TEXT',
              visible: true,
              required: false,
              clearPaths: []
            }
          ]
        }
      ]
    },
    {
      id: 'details',
      label: 'Details',
      order: 2,
      sections: [
        {
          id: 'details-section',
          label: 'Details',
          order: 1,
          nodes: [
            {
              id: 'notes',
              path: ['notes'],
              label: 'Notes',
              kind: 'INPUT',
              type: 'TEXT',
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

const V2Renderer = FormRenderer({
  defaultValues: testDefaults
})

function TestV2Form({ onCancel = vi.fn() }: { onCancel?: () => void }) {
  const defaultValues = useMemo(() => structuredClone(testDefaults), [])
  const model = useMemo(() => structuredClone(testModel), [])
  const form = useAppForm({
    defaultValues,
    onSubmit: async () => undefined
  })

  return (
    <AuthoringLayout>
      <form.AppForm>
        <TestV2Content form={form} model={model} onCancel={onCancel} />
      </form.AppForm>
    </AuthoringLayout>
  )
}

const TestV2Content = withForm({
  defaultValues: testDefaults,
  props: {} as {
    model: NodeRuntimeResolveResponseDto
    onCancel: () => void
  },
  render: function TestV2Content({ form, model, onCancel }) {
    const {
      updateAuthoringFormActions,
      updateAuthoringFormState
    } = useAuthoringForm()
    const nameValue = useStore(form.store, (state) => state.values.name)
    const statePatch = useMemo(
      () => ({
        cancelLabel: 'Cancel',
        mapId: 'test-form-v2',
        mode: 'edit' as const,
        providedModel: model,
        readOnly: false,
        resolveModel: false,
        subjectKindLabel: 'Test Form'
      }),
      [model]
    )
    const actions = useMemo(() => ({ onCancel }), [onCancel])

    useEffect(() => {
      updateAuthoringFormState(statePatch)
    }, [statePatch, updateAuthoringFormState])

    useEffect(() => {
      updateAuthoringFormActions(actions)
    }, [actions, updateAuthoringFormActions])

    return (
      <>
        <V2Renderer form={form} />
        <output aria-label='name value'>{nameValue}</output>
      </>
    )
  }
})

describe('authoring form renderer v2', () => {
  it('renders the first visible step and skips hidden or system-managed nodes', () => {
    render(
      <TestRouterProvider>
        <TestV2Form />
      </TestRouterProvider>
    )

    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /level/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /^id$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /order/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /hidden text/i })).not.toBeInTheDocument()
  })

  it('calls cancel when Back is clicked on the first step', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <TestRouterProvider>
        <TestV2Form onCancel={onCancel} />
      </TestRouterProvider>
    )

    await user.click(screen.getByRole('button', { name: /^back$/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('moves Back to the previous step after the first step', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <TestRouterProvider>
        <TestV2Form onCancel={onCancel} />
      </TestRouterProvider>
    )

    await user.click(screen.getByRole('button', { name: /^next$/i }))
    expect(screen.getByRole('textbox', { name: /notes/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^back$/i }))

    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('advances with Next until the last step', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider>
        <TestV2Form />
      </TestRouterProvider>
    )

    const nextButton = screen.getByRole('button', { name: /^next$/i })
    expect(nextButton).toBeEnabled()

    await user.click(nextButton)

    expect(screen.getByRole('textbox', { name: /notes/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^activate$/i })).toBeEnabled()
  })

  it('updates TanStack form state when fields change', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider>
        <TestV2Form />
      </TestRouterProvider>
    )

    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Fire Lace')

    expect(screen.getByLabelText('name value')).toHaveTextContent('Fire Lace')
  })
})

describe('authoring default value helpers', () => {
  it('chooses draft values before active values and clones the selected values', () => {
    const draftValues = { details: { label: 'Draft' } }
    const activeValues = { details: { label: 'Active' } }
    const selected = chooseInitialAuthoringFormValues({
      draftValues,
      activeValues,
      createEmptyValues: () => ({ details: { label: 'Empty' } })
    })

    selected.details.label = 'Changed'

    expect(selected).toEqual({ details: { label: 'Changed' } })
    expect(draftValues).toEqual({ details: { label: 'Draft' } })
  })

  it('falls back to active values and then the empty-value factory', () => {
    const createEmptyValues = vi.fn(() => ({ id: 'generated-id', order: 1 }))

    expect(
      chooseInitialAuthoringFormValues({
        activeValues: { id: 'active-id', order: 2 },
        createEmptyValues
      })
    ).toEqual({ id: 'active-id', order: 2 })
    expect(createEmptyValues).not.toHaveBeenCalled()

    expect(
      chooseInitialAuthoringFormValues({
        createEmptyValues
      })
    ).toEqual({ id: 'generated-id', order: 1 })
    expect(createEmptyValues).toHaveBeenCalledTimes(1)
  })

  it('creates child node defaults through node factories', () => {
    const arrayNode: NodeRuntimeNodeDto = {
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
    const objectNode: NodeRuntimeNodeDto = {
      id: 'cost',
      path: ['cost'],
      label: 'Cost',
      kind: 'GROUP',
      groupKind: 'OBJECT',
      childMapId: 'cost',
      visible: true,
      required: false,
      clearPaths: []
    }

    expect(createDefaultAuthoringArrayItem(arrayNode, 1)).toEqual(
      expect.objectContaining({ label: '', order: 2 })
    )
    expect(createDefaultAuthoringObjectItem(objectNode)).toEqual({
      amount: 0,
      currencyId: ''
    })
  })
})
