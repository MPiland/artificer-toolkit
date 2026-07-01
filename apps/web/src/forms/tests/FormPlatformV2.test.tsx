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
import { buildAuthoringNavigationTree } from '../layout/authoringNavigation'
import { toAuthoringRailSummaries } from '../layout/Steps/Steps.utils'
import { getAuthoringProgress } from '../validation/authoringProgress'

type TestFormValues = {
  category: string | undefined
  description: string
  features?: Array<Record<string, unknown>>
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

const groupModel = {
  ...testModel,
  steps: [
    {
      id: 'features',
      label: 'Features',
      order: 1,
      sections: [
        {
          id: 'features-section',
          label: 'Features',
          order: 1,
          nodes: [
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

const mixedGroupModel = {
  ...testModel,
  steps: [
    {
      id: 'traits',
      label: 'Traits',
      order: 1,
      sections: [
        {
          id: 'traits-section',
          label: 'Traits',
          order: 1,
          nodes: [
            {
              id: 'size',
              path: ['size'],
              label: 'Size',
              kind: 'INPUT',
              type: 'SELECT_SINGLE',
              visible: true,
              required: true,
              options: [{ value: 'MEDIUM', label: 'Medium' }],
              clearPaths: []
            },
            {
              id: 'details',
              path: ['details'],
              label: 'Details',
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

const simpleArrayModel = {
  ...testModel,
  steps: [
    {
      id: 'details',
      label: 'Details',
      order: 1,
      sections: [
        {
          id: 'details-section',
          label: 'Details',
          order: 1,
          nodes: [
            {
              id: 'details',
              path: ['details'],
              label: 'Details',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'detail',
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

function TestV2Form({
  model: modelInput = testModel,
  onCancel = vi.fn()
}: {
  model?: NodeRuntimeResolveResponseDto
  onCancel?: () => void
}) {
  const defaultValues = useMemo(() => structuredClone(testDefaults), [])
  const model = useMemo(() => structuredClone(modelInput), [modelInput])
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

  it('calls cancel when Cancel is clicked on the first step', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <TestRouterProvider>
        <TestV2Form onCancel={onCancel} />
      </TestRouterProvider>
    )

    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

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

    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Fire Lace')

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

  it('renders empty array groups as overview screens without item rows', () => {
    render(
      <TestRouterProvider>
        <TestV2Form model={groupModel} />
      </TestRouterProvider>
    )

    expect(screen.getByRole('heading', { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument()
    expect(screen.getByText('No features added yet.')).toBeInTheDocument()
    expect(screen.queryByText('Feature 1')).not.toBeInTheDocument()
  })

  it('adds an array group item and selects its first child leaf', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider>
        <TestV2Form model={groupModel} />
      </TestRouterProvider>
    )

    expect(screen.getAllByText('Features').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /^add$/i }))

    expect(screen.getAllByText('Feature 1').length).toBeGreaterThan(0)
    expect(await screen.findByRole('textbox', { name: /name/i })).toBeInTheDocument()
  })

})

describe('authoring navigation tree', () => {
  it('marks direct required step targets incomplete when required values are empty', () => {
    const navigation = buildAuthoringNavigationTree({
      mapId: testModel.mapId,
      model: testModel,
      values: testDefaults
    })
    const basicsTarget = navigation.navigationTargets.find((target) => target.stepId === 'basics')

    expect(basicsTarget).toEqual(expect.objectContaining({ label: 'Basics' }))
    expect(navigation.stepStatuses[basicsTarget?.id ?? '']).toBe('incomplete')
    expect(navigation.navigationTree.find((node) => node.label === 'Basics')).toEqual(
      expect.objectContaining({ status: 'incomplete' })
    )
    expect(navigation.progressSummary.incompleteCount).toBeGreaterThan(0)
    expect(navigation.progressSummary.completeCount).toBeLessThan(navigation.progressSummary.stepCount)
  })

  it('shows empty arrays as a selectable step without item rows', () => {
    const navigation = buildAuthoringNavigationTree({
      mapId: groupModel.mapId,
      model: groupModel,
      values: { ...testDefaults, features: [] }
    })

    expect(navigation.navigationTargets).toContainEqual(
      expect.objectContaining({
        collectionFieldName: 'features',
        kind: 'overview'
      })
    )
    expect(navigation.navigationTree).toEqual([
      expect.objectContaining({
        children: undefined,
        label: 'Features'
      })
    ])
    expect(navigation.navigationTree.map((node) => node.label)).not.toContain('Overview')
    expect(JSON.stringify(navigation.navigationTree)).not.toContain('Feature 1')
  })

  it('adds array item rows with child step leaves when values exist', () => {
    const navigation = buildAuthoringNavigationTree({
      mapId: groupModel.mapId,
      model: groupModel,
      values: { ...testDefaults, features: [{ label: '' }] }
    })

    expect(JSON.stringify(navigation.navigationTree)).toContain('Feature 1')
    expect(navigation.navigationTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPathPrefix: 'features[0]',
          kind: 'step',
          mapId: 'feature'
        })
      ])
    )
  })

  it('keeps simple child maps inline in the owning step', () => {
    const navigation = buildAuthoringNavigationTree({
      mapId: simpleArrayModel.mapId,
      model: simpleArrayModel,
      values: {
        ...testDefaults,
        details: [{ label: 'Personality Trait 1' }]
      }
    })

    expect(navigation.navigationTargets).toEqual([
      expect.objectContaining({
        kind: 'step',
        label: 'Details',
        stepId: 'details'
      })
    ])
    expect(navigation.navigationTree).toEqual([
      expect.objectContaining({
        children: undefined,
        label: 'Details'
      })
    ])
    expect(JSON.stringify(navigation.navigationTree)).not.toContain('Personality Trait 1')
  })

  it('keeps arrays inline when the owning step has direct editable content', () => {
    const navigation = buildAuthoringNavigationTree({
      mapId: mixedGroupModel.mapId,
      model: mixedGroupModel,
      values: {
        ...testDefaults,
        details: [{ label: 'Size' }],
        size: 'MEDIUM'
      }
    })

    expect(navigation.navigationTargets).toHaveLength(1)
    expect(navigation.navigationTargets[0]).toEqual(
      expect.objectContaining({
        kind: 'step',
        label: 'Traits',
        stepId: 'traits'
      })
    )
    expect(navigation.navigationTargets).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionFieldName: 'details',
          kind: 'overview'
        })
      ])
    )
    expect(JSON.stringify(navigation.navigationTree)).not.toContain('Detail 1')
  })
})

describe('authoring rail summaries', () => {
  it('keeps completed step count visually separate from issue count', () => {
    const summaries = toAuthoringRailSummaries({
      hasChanges: false,
      mode: 'create',
      stepStatuses: {
        basics: 'incomplete',
        details: 'complete'
      },
      summary: {
        completeCount: 1,
        errorCount: 0,
        incompleteCount: 1,
        stepCount: 2,
        warningCount: 0
      },
      visitedStepIds: new Set(['details'])
    })

    expect(summaries).toEqual([
      expect.objectContaining({
        label: 'steps',
        markerLabel: 'Completed steps',
        status: 'complete',
        value: '1/2'
      }),
      expect.objectContaining({
        label: 'issue',
        markerLabel: 'Issues found',
        status: 'warning',
        value: '1'
      }),
      expect.objectContaining({
        label: 'status',
        markerLabel: 'New item',
        status: 'empty',
        value: 'New'
      })
    ])
  })

  it('labels unchanged edit forms as saved', () => {
    const summaries = toAuthoringRailSummaries({
      hasChanges: false,
      mode: 'edit',
      stepStatuses: {
        basics: 'complete'
      },
      summary: {
        completeCount: 1,
        errorCount: 0,
        incompleteCount: 0,
        stepCount: 1,
        warningCount: 0
      },
      visitedStepIds: new Set()
    })

    expect(summaries).toEqual([
      expect.objectContaining({ label: 'steps', status: 'complete', value: '1/1' }),
      expect.objectContaining({ label: 'issues', markerLabel: 'No issues', status: 'complete' }),
      expect.objectContaining({ label: 'status', status: 'complete', value: 'Saved' })
    ])
  })
})

describe('authoring progress', () => {
  it('marks missing required group nodes incomplete', () => {
    const requiredGroupModel = {
      ...groupModel,
      steps: groupModel.steps.map((step) => ({
        ...step,
        sections: step.sections.map((section) => ({
          ...section,
          nodes: section.nodes.map((node) => ({
            ...node,
            required: true
          }))
        }))
      }))
    } satisfies NodeRuntimeResolveResponseDto

    const progress = getAuthoringProgress({
      model: requiredGroupModel,
      values: { ...testDefaults, features: [] }
    })

    expect(progress.stepStatuses.features).toBe('incomplete')
    expect(progress.canFinalize).toBe(false)
  })

  it('marks object groups incomplete when required child fields are missing', () => {
    const requiredChildGroupModel = {
      ...groupModel,
      steps: [
        {
          id: 'charges',
          label: 'Charges',
          order: 1,
          sections: [
            {
              id: 'charges-section',
              label: 'Charges',
              order: 1,
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
            }
          ]
        }
      ]
    } satisfies NodeRuntimeResolveResponseDto

    const progress = getAuthoringProgress({
      model: requiredChildGroupModel,
      values: { ...testDefaults, charges: {} }
    })

    expect(progress.stepStatuses.charges).toBe('incomplete')
    expect(progress.canFinalize).toBe(false)
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
