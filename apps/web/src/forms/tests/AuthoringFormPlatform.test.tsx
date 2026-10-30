import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState, type ReactElement } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSelector } from '@tanstack/react-form'
import { useRouter } from '@tanstack/react-router'
import {
  nodeRuntimeResolveRequestDtoSchema,
  type NodeRuntimeNodeDto,
  type NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { compactNodeRuntimeResponse } from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import { warmFixtureAuthoredSources } from '@artificer-toolkit/authoring/nodeRuntime/srdSourceReader'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  resolveArrayAuthoringMeta,
  resolveInputAuthoringMeta,
  resolveObjectAuthoringMeta
} from '@artificer-toolkit/shared/maps'
import {
  authoredRouteStoryRecords,
  createEditLoaderData,
  seedStorySystemId
} from '#domains/authoredRouteStory.fixtures'
import type { CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'
import { AuthoringFormProvider } from '#forms/layout/AuthoringFormProvider'
import { AuthoringLayoutContent } from '#forms/layout/AuthoringLayout'
import { useAuthoringFormStore, useAuthoringResolution } from '#forms/layout/AuthoringFormContext'
import {
  createDefaultAuthoringArrayItem,
  createDefaultAuthoringObjectItem
} from '#forms/rendering/authoringNodeDefaults'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { buildAuthoringNavigationTree } from '../layout/authoringNavigation'
import { toAuthoringRailSummaries } from '../layout/Steps/Steps.utils'
import { getAuthoringProgress } from '../validation/authoringProgress'
import { withResolvedScopes } from './withResolvedScopes'

const convexMocks = vi.hoisted(() => ({
  mutation: vi.fn(),
  nodeRuntimeResolve: vi.fn(),
  query: vi.fn()
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useAction: () => vi.fn(),
  useConvex: () => convexMocks,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useMutation: () => vi.fn(),
  useQuery: () => ({ assetId: null, revision: 0 })
}))

vi.mock('#app/query/createAppQueryClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#app/query/createAppQueryClient')>()
  return {
    ...actual,
    createAppQueryClient: () => {
      const client = actual.createAppQueryClient()
      client.setQueryDefaults(['convexQuery'], {
        queryFn: () => {
          throw new Error('Unexpected native query in the authoring platform harness.')
        }
      })
      client.setQueryDefaults(['convexQuery', getFunctionName(api.authoring.nodeRuntime.resolve)], {
        queryFn: ({ queryKey }) => convexMocks.nodeRuntimeResolve(queryKey)
      })
      return client
    }
  }
})

beforeAll(warmFixtureAuthoredSources, 60_000)

beforeEach(() => {
  convexMocks.mutation.mockReset().mockResolvedValue({
    subjectId: authoredRouteStoryRecords.creature.id,
    label: 'Fire Lace'
  })
  convexMocks.nodeRuntimeResolve.mockReset()
  convexMocks.query
    .mockReset()
    .mockResolvedValue({ values: {}, clearedPaths: [], refusedPaths: [] })
})

type TestFormValues = {
  category: string | undefined
  complex?: Record<string, unknown>
  description: string
  features?: Array<Record<string, unknown>>
  id: string
  level: number
  name: string
  notes: string
  order: number
  outcomes?: Array<Record<string, unknown>>
  simple?: Record<string, unknown>
  systemId: string
}

const testDefaults: TestFormValues = {
  category: undefined,
  description: '',
  id: authoredRouteStoryRecords.creature.id,
  level: 1,
  name: '',
  notes: '',
  order: 1,
  systemId: seedStorySystemId
}

const inputAuthoring = resolveInputAuthoringMeta(undefined)
const systemInputAuthoring = resolveInputAuthoringMeta({ exposure: 'system' })

function arrayAuthoring(
  label: string,
  presentation: 'inline' | 'table' | 'summary' | 'branch' | 'focused',
  rowSummary?: 'outcome'
) {
  return resolveArrayAuthoringMeta(
    label,
    presentation,
    undefined,
    rowSummary ? { collection: { rowSummary } } : undefined
  )
}

const testModel = {
  mapId: 'test-authoring-form',
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
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: systemInputAuthoring
            },
            {
              id: 'order',
              path: ['order'],
              label: 'Order',
              kind: 'INPUT',
              type: 'NUMBER',
              visible: true,
              required: true,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: systemInputAuthoring
            },
            {
              id: 'hiddenText',
              path: ['hiddenText'],
              label: 'Hidden Text',
              kind: 'INPUT',
              type: 'TEXT',
              visible: false,
              required: false,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: inputAuthoring
            },
            {
              id: 'name',
              path: ['name'],
              label: 'Name',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: true,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: inputAuthoring
            },
            {
              id: 'level',
              path: ['level'],
              label: 'Level',
              kind: 'INPUT',
              type: 'NUMBER',
              visible: true,
              required: true,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: inputAuthoring
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
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: inputAuthoring
            },
            {
              id: 'description',
              path: ['description'],
              label: 'Description',
              kind: 'INPUT',
              type: 'RICH_TEXT',
              visible: true,
              required: false,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: inputAuthoring
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
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: inputAuthoring
            }
          ]
        }
      ]
    }
  ],
  scopes: []
} satisfies NodeRuntimeResolveResponseDto

const groupModel = {
  ...testModel,
  steps: [
    {
      id: 'features',
      label: 'Features',
      description: 'Add and organize the abilities this item provides.',
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
              presentation: 'focused',
              visible: true,
              required: false,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: arrayAuthoring('Feature', 'focused')
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const sectionedGroupModel = {
  ...groupModel,
  steps: groupModel.steps.map((step) => ({
    ...step,
    label: 'Mechanics'
  }))
} satisfies NodeRuntimeResolveResponseDto

const surfacedGroupModel = {
  ...groupModel,
  steps: groupModel.steps.map((step) => ({
    ...step,
    label: 'Mechanics',
    sections: step.sections.map((section) => ({
      ...section,
      label: 'Abilities'
    }))
  }))
} satisfies NodeRuntimeResolveResponseDto

const branchGroupModel = {
  ...groupModel,
  steps: groupModel.steps.map((step) => ({
    ...step,
    sections: step.sections.map((section) => ({
      ...section,
      nodes: section.nodes.map((node) => ({
        ...node,
        presentation: 'branch' as const,
        authoring: arrayAuthoring('Feature', 'branch')
      }))
    }))
  }))
} satisfies NodeRuntimeResolveResponseDto

const summaryGroupModel = {
  ...testModel,
  steps: [
    {
      id: 'outcomes',
      label: 'Outcomes',
      order: 1,
      sections: [
        {
          id: 'outcomes-section',
          label: 'Outcomes',
          order: 1,
          nodes: [
            {
              id: 'outcomes',
              path: ['outcomes'],
              label: 'Outcomes',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'outcome',
              presentation: 'summary',
              visible: true,
              required: false,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: arrayAuthoring('Outcome', 'summary', 'outcome')
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const focusedGroupModel = {
  ...summaryGroupModel,
  steps: summaryGroupModel.steps.map((step) => ({
    ...step,
    sections: step.sections.map((section) => ({
      ...section,
      nodes: section.nodes.map((node) => ({
        ...node,
        presentation: 'focused' as const,
        authoring: arrayAuthoring('Outcome', 'focused', 'outcome')
      }))
    }))
  }))
} satisfies NodeRuntimeResolveResponseDto

const summaryGroupWithNameModel = {
  ...summaryGroupModel,
  steps: summaryGroupModel.steps.map((step) => ({
    ...step,
    sections: step.sections.map((section) => ({
      ...section,
      nodes: [
        {
          id: 'name',
          path: ['name'],
          label: 'Name',
          kind: 'INPUT' as const,
          type: 'TEXT' as const,
          visible: true,
          required: true,
          hiddenBehavior: 'KEEP',
          clearPaths: [],
          authoring: inputAuthoring
        },
        ...section.nodes
      ]
    }))
  }))
} satisfies NodeRuntimeResolveResponseDto

const complexObjectModel = {
  ...testModel,
  steps: [
    {
      id: 'configuration',
      label: 'Configuration',
      order: 1,
      sections: [
        {
          id: 'configuration-section',
          label: 'Configuration',
          order: 1,
          nodes: [
            {
              id: 'complex',
              path: ['complex'],
              label: 'Feature Configuration',
              kind: 'GROUP',
              groupKind: 'OBJECT',
              childMapId: 'feature',
              presentation: 'branch',
              visible: true,
              required: false,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: resolveObjectAuthoringMeta('Feature Configuration', undefined)
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const simpleObjectModel = {
  ...testModel,
  steps: [
    {
      id: 'configuration',
      label: 'Configuration',
      order: 1,
      sections: [
        {
          id: 'configuration-section',
          label: 'Configuration',
          order: 1,
          nodes: [
            {
              id: 'simple',
              path: ['simple'],
              label: 'Weight',
              kind: 'GROUP',
              groupKind: 'OBJECT',
              childMapId: 'weight',
              presentation: 'inline',
              visible: true,
              required: false,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: resolveObjectAuthoringMeta('Weight', undefined)
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
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: inputAuthoring
            },
            {
              id: 'details',
              path: ['details'],
              label: 'Details',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'feature',
              presentation: 'inline',
              visible: true,
              required: false,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: arrayAuthoring('Details', 'inline')
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
              presentation: 'inline',
              visible: true,
              required: false,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: arrayAuthoring('Details', 'inline')
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

/**
 * Renders the creature authoring session (real provider, layout and renderer). The synthetic
 * `defaultValues` become the loaded creature record, so they reach the form through the session's
 * own initial values. The fake node-runtime resolve answers with the synthetic `model` resolved
 * against the form's own values. `onCancel` fires when the session navigates to another page,
 * which is what Cancel does.
 */
function TestAuthoringForm({
  defaultValues = testDefaults,
  model = testModel,
  onCancel = vi.fn()
}: {
  defaultValues?: TestFormValues
  model?: NodeRuntimeResolveResponseDto
  onCancel?: () => void
}) {
  useState(() => {
    convexMocks.nodeRuntimeResolve.mockImplementation(async (queryKey: readonly unknown[]) => {
      const { values } = nodeRuntimeResolveRequestDtoSchema.parse(queryKey[2])
      return compactNodeRuntimeResponse(
        await withResolvedScopes({ ...structuredClone(model), mapId: 'creature' }, values)
      )
    })
  })
  // The synthetic values are not a full creature; the session only reads them back as form values.
  // The seed creature's own features are cleared so the models' collections start from the test's values.
  const record = {
    ...authoredRouteStoryRecords.creature,
    features: [],
    ...structuredClone(defaultValues)
  } as unknown as CreatureAuthoredDto
  const { authoringData } = createEditLoaderData('creature', 'ownedActive', record)

  return (
    <AuthoringFormProvider data={authoringData} domain='creature' mode='edit'>
      <ResolvedFormContent onCancel={onCancel} />
    </AuthoringFormProvider>
  )
}

function ResolvedFormContent({ onCancel }: { onCancel: () => void }) {
  const { model } = useAuthoringResolution()

  if (!model) return null

  return (
    <>
      <LeavePageSpy onLeave={onCancel} />
      <FormValueOutputs />
      <AuthoringLayoutContent />
    </>
  )
}

function LeavePageSpy({ onLeave }: { onLeave: () => void }) {
  const router = useRouter()

  useEffect(
    () =>
      router.subscribe('onBeforeNavigate', ({ pathChanged }) => {
        if (pathChanged) onLeave()
      }),
    [onLeave, router]
  )

  return null
}

function FormValueOutputs() {
  const { form } = useAuthoringFormStore()
  const formValues = useSelector(form.store, (state) => state.values)

  return (
    <>
      <output aria-label='name value'>{'name' in formValues ? String(formValues.name) : ''}</output>
      <output aria-label='form values'>{JSON.stringify(formValues)}</output>
    </>
  )
}

async function renderForm(ui: ReactElement) {
  const result = render(ui)
  await screen.findByLabelText('name value')
  return result
}

describe('authoring form platform', () => {
  it('renders the first visible step and skips hidden or system-managed nodes', async () => {
    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm />
      </TestRouterProvider>
    )

    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /level/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /^id$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /order/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /hidden text/i })).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Basics' }).parentElement
    ).toHaveTextContent(/^Basics$/)
  })

  it('keeps Cancel out of the floating step-navigation action bar', async () => {
    const onCancel = vi.fn()

    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm onCancel={onCancel} />
      </TestRouterProvider>
    )

    expect(screen.getByRole('button', { name: /^back$/i })).toBeDisabled()
    expect(
      within(screen.getByTestId('authoring-action-bar')).queryByRole('link', {
        name: /^cancel$/i
      })
    ).not.toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('moves Back to the previous step after the first step', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm onCancel={onCancel} />
      </TestRouterProvider>
    )

    await user.click(screen.getByRole('link', { name: /^next$/i }))
    expect(screen.getByRole('textbox', { name: /notes/i })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /^back$/i }))

    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('advances with Next until the last step', async () => {
    const user = userEvent.setup()

    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm />
      </TestRouterProvider>
    )

    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Fire Lace')

    const nextLink = screen.getByRole('link', { name: /^next$/i })
    expect(nextLink).toHaveAttribute('href')

    await user.click(nextLink)

    expect(screen.getByRole('textbox', { name: /notes/i })).toBeInTheDocument()
    const actionBar = within(screen.getByTestId('authoring-action-bar'))
    expect(actionBar.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument()
    // Completion is derived from the debounced form state, so Activate enables once typing pauses.
    await waitFor(() =>
      expect(actionBar.getByRole('button', { name: /^activate$/i })).toBeEnabled()
    )
  })

  it('updates TanStack form state when fields change', async () => {
    const user = userEvent.setup()

    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm />
      </TestRouterProvider>
    )

    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Fire Lace')

    expect(screen.getByLabelText('name value')).toHaveTextContent('Fire Lace')
  })

  it('renders empty array groups as overview screens without item rows', async () => {
    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm model={groupModel} />
      </TestRouterProvider>
    )

    expect(screen.queryByText('Overview')).not.toBeInTheDocument()
    const editor = within(screen.getByTestId('authoring-form-content'))
    expect(editor.getAllByText('Features')).toHaveLength(1)
    expect(editor.getByRole('heading', { level: 2, name: /features/i })).toBeInTheDocument()
    expect(
      editor.getByText('Add and organize the abilities this item provides.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^add feature$/i })).toBeInTheDocument()
    expect(screen.getByText('No features added yet.')).toBeInTheDocument()
    expect(screen.queryByText('Feature 1')).not.toBeInTheDocument()
  })

  it('does not repeat a collection heading already owned by its section', async () => {
    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm model={sectionedGroupModel} />
      </TestRouterProvider>
    )

    expect(screen.getAllByRole('heading', { name: /features/i })).toHaveLength(1)
    expect(screen.getByText('No features added yet.')).toBeInTheDocument()
    expect(
      screen
        .getByTestId('authoring-form-content')
        .querySelector('[data-section-surface="rows-only"]')
    ).toBeInTheDocument()
  })

  it('keeps the parent section surface when the collection owns a distinct heading', async () => {
    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm model={surfacedGroupModel} />
      </TestRouterProvider>
    )

    expect(screen.getByRole('heading', { level: 3, name: 'Abilities' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Features' })).toBeInTheDocument()
    expect(
      screen.getByTestId('authoring-form-content').querySelector('[data-section-surface="panel"]')
    ).toBeInTheDocument()
  })

  it('adds a focused array item in the overlay editor', async () => {
    const user = userEvent.setup()

    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm model={groupModel} />
      </TestRouterProvider>
    )

    expect(screen.getAllByText('Features').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /^add feature$/i }))

    expect(screen.getAllByText('Feature 1').length).toBeGreaterThan(0)
    const dialog = await screen.findByRole('dialog', { name: /add feature/i })
    expect(await within(dialog).findByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(screen.getByTestId('authoring-form-canvas')).toBeInTheDocument()
    expect(document.querySelector('.mantine-Drawer-overlay')).not.toBeNull()
  })

  it('cancels a staged summary add and restores focus without changing the owning leaf', async () => {
    const user = userEvent.setup()

    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm
          defaultValues={{ ...testDefaults, outcomes: [] }}
          model={summaryGroupModel}
        />
      </TestRouterProvider>
    )

    const addOutcome = screen.getByRole('button', { name: /^add outcome$/i })
    const valuesBefore = screen.getByLabelText('form values').textContent
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    await user.click(addOutcome)

    const drawer = screen.getByRole('dialog', { name: /add outcome/i })
    expect(drawer).toBeInTheDocument()
    expect(document.querySelector('.mantine-Drawer-overlay')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled()

    await user.click(within(drawer).getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('form values').textContent).toBe(valuesBefore)
    expect(screen.getByText('No outcomes added yet.')).toBeInTheDocument()
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    await waitFor(() => expect(addOutcome).toHaveFocus())
  })

  it('restores a cancelled summary edit exactly and retains a saved edit', async () => {
    const user = userEvent.setup()
    const initialValues: TestFormValues = {
      ...testDefaults,
      outcomes: [
        {
          id: 'damage-1',
          effectKind: 'DAMAGE',
          valueKind: 'DICE',
          scalingKind: 'NONE',
          diceConfig: '1d6',
          damageTypeId: 'fire'
        }
      ]
    }

    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm defaultValues={initialValues} model={summaryGroupModel} />
      </TestRouterProvider>
    )

    const damageOpener = screen.getByRole('button', { name: /^damage$/i })
    const valuesBefore = screen.getByLabelText('form values').textContent
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    await user.click(damageOpener)

    let drawer = screen.getByRole('dialog', { name: /edit damage/i })
    let diceConfig = within(drawer).getByRole('textbox', { name: /dice config/i })
    await user.clear(diceConfig)
    await user.type(diceConfig, '9d9')
    expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled()

    await user.click(within(drawer).getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('form values').textContent).toBe(valuesBefore)
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    await waitFor(() => expect(damageOpener).toHaveFocus())

    await user.click(damageOpener)
    drawer = screen.getByRole('dialog', { name: /edit damage/i })
    diceConfig = within(drawer).getByRole('textbox', { name: /dice config/i })
    expect(diceConfig).toHaveValue('1d6')
    await user.clear(diceConfig)
    await user.type(diceConfig, '2d8')
    await user.click(within(drawer).getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('form values')).toHaveTextContent('"diceConfig":"2d8"')
    expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    await waitFor(() => expect(damageOpener).toHaveFocus())
  }, 10_000)

  it('restores only the cancelled drawer subtree while retaining unrelated dirty state', async () => {
    const user = userEvent.setup()
    const initialValues: TestFormValues = {
      ...testDefaults,
      outcomes: [
        {
          id: 'damage-1',
          effectKind: 'DAMAGE',
          valueKind: 'DICE',
          scalingKind: 'NONE',
          diceConfig: '1d6',
          damageTypeId: 'fire'
        }
      ]
    }

    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm defaultValues={initialValues} model={summaryGroupWithNameModel} />
      </TestRouterProvider>
    )

    const name = screen.getByRole('textbox', { name: /^name$/i })
    await user.type(name, 'Kept edit')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    const damageOpener = screen.getByRole('button', { name: /^damage$/i })
    await user.click(damageOpener)
    const drawer = screen.getByRole('dialog', { name: /edit damage/i })
    const diceConfig = within(drawer).getByRole('textbox', { name: /dice config/i })
    await user.clear(diceConfig)
    await user.type(diceConfig, '9d9')
    await user.click(within(drawer).getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(name).toHaveValue('Kept edit')
    expect(screen.getByLabelText('form values')).toHaveTextContent('"diceConfig":"1d6"')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('keeps a focused drawer collection on the canvas while editing a leaf in an overlay', async () => {
    const user = userEvent.setup()
    const initialValues: TestFormValues = {
      ...testDefaults,
      outcomes: [
        {
          id: 'damage-1',
          effectKind: 'DAMAGE',
          valueKind: 'DICE',
          scalingKind: 'NONE',
          diceConfig: '1d6',
          damageTypeId: 'fire'
        }
      ]
    }

    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm defaultValues={initialValues} model={focusedGroupModel} />
      </TestRouterProvider>
    )

    const damageOpener = screen.getByRole('button', { name: /^edit damage$/i })
    const canvasHeading = screen.getByRole('heading', { name: /^outcomes$/i })
    const canvasWidth = canvasHeading.closest('section')?.getBoundingClientRect().width
    await user.click(damageOpener)

    const drawer = screen.getByRole('dialog', { name: /edit damage/i })
    expect(drawer).toBeInTheDocument()
    expect(document.querySelector('.mantine-Drawer-overlay')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^outcomes$/i })).toBeInTheDocument()
    expect(canvasHeading.closest('section')?.getBoundingClientRect().width).toBe(canvasWidth)

    await user.click(within(drawer).getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^edit damage$/i })).toHaveFocus()
    )

    const navigation = screen.getByRole('navigation', { name: /^authoring steps$/i })
    await user.click(within(navigation).getByRole('link', { name: /^damage/i }))

    const railDrawer = screen.getByRole('dialog', { name: /edit damage/i })
    expect(railDrawer).toBeInTheDocument()
    await user.click(within(railDrawer).getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps an absent optional complex object inline so it can be added', async () => {
    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm model={complexObjectModel} />
      </TestRouterProvider>
    )

    expect(screen.getByRole('button', { name: /^add feature configuration$/i })).toBeInTheDocument()
    expect(
      screen.getByText('Feature Configuration has not been configured yet.')
    ).toBeInTheDocument()
  })

  it('keeps populated simple object groups inline', async () => {
    await renderForm(
      <TestRouterProvider>
        <TestAuthoringForm
          defaultValues={{ ...testDefaults, simple: { amount: 12, unit: 'POUNDS' } }}
          model={simpleObjectModel}
        />
      </TestRouterProvider>
    )

    expect(screen.getByRole('textbox', { name: /amount/i })).toHaveValue('12')
    expect(screen.getByRole('combobox', { name: /unit/i })).toBeInTheDocument()
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
    expect(navigation.progressSummary.completeCount).toBeLessThan(
      navigation.progressSummary.stepCount
    )
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

  it('makes populated branch collections selectable without a synthetic Overview row', async () => {
    const values = { ...testDefaults, features: [{ label: 'Arcane Ward' }] }
    const navigation = buildAuthoringNavigationTree({
      mapId: branchGroupModel.mapId,
      model: await withResolvedScopes(branchGroupModel, values),
      values
    })
    const features = navigation.navigationTree[0]

    expect(features).toEqual(
      expect.objectContaining({
        label: 'Features',
        target: expect.objectContaining({
          collectionFieldName: 'features',
          kind: 'overview'
        })
      })
    )
    expect(features?.children?.map((child) => child.label)).not.toContain('Overview')
  })

  it('adds focused array rows as drawer leaves when values exist', async () => {
    const values = { ...testDefaults, features: [{ label: '' }] }
    const navigation = buildAuthoringNavigationTree({
      mapId: groupModel.mapId,
      model: await withResolvedScopes(groupModel, values),
      values
    })
    const nestedFeatureTarget = navigation.navigationTargets.find(
      (target) => target.fieldPathPrefix === 'features[0]' && target.kind === 'drawer-item'
    )

    expect(JSON.stringify(navigation.navigationTree)).toContain('Feature 1')
    expect(navigation.navigationTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPathPrefix: 'features[0]',
          kind: 'drawer-item',
          mapId: 'feature'
        })
      ])
    )
    expect(nestedFeatureTarget?.parentValues).toBe(values)
    expect(nestedFeatureTarget?.parentValues).not.toBe(values.features?.[0])
  })

  it('exposes focused drawer rows as rail leaves without expanding their child map', () => {
    const navigation = buildAuthoringNavigationTree({
      mapId: focusedGroupModel.mapId,
      model: focusedGroupModel,
      values: {
        ...testDefaults,
        outcomes: [{ id: 'damage-1', effectKind: 'DAMAGE' }]
      }
    })

    expect(navigation.navigationTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionFieldName: 'outcomes',
          kind: 'overview'
        }),
        expect.objectContaining({
          collectionFieldName: 'outcomes',
          drawerRowIndex: 0,
          fieldPathPrefix: 'outcomes[0]',
          kind: 'drawer-item',
          mapId: 'outcome'
        })
      ])
    )
    expect(navigation.navigationTree).toEqual([
      expect.objectContaining({
        children: [expect.objectContaining({ label: 'Damage' })],
        label: 'Outcomes'
      })
    ])
    expect(navigation.navigationTargets).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'step', mapId: 'outcome' })])
    )
  })

  it('uses populated complex object groups as rail branches', async () => {
    const values = {
      ...testDefaults,
      complex: {
        id: 'feature-1',
        label: 'Nested Feature',
        description: '',
        order: 1,
        attributes: [],
        details: [],
        effects: [],
        optionChoices: [],
        options: []
      }
    }
    const navigation = buildAuthoringNavigationTree({
      mapId: complexObjectModel.mapId,
      model: await withResolvedScopes(complexObjectModel, values),
      values
    })

    expect(navigation.navigationTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPathPrefix: 'complex',
          kind: 'step',
          mapId: 'feature'
        })
      ])
    )
    expect(navigation.navigationTree).toEqual([
      expect.objectContaining({
        label: 'Configuration'
      })
    ])
  })

  it('keeps absent complex and populated simple object groups in their owning leaf', () => {
    const absentComplex = buildAuthoringNavigationTree({
      mapId: complexObjectModel.mapId,
      model: complexObjectModel,
      values: testDefaults
    })
    const populatedSimple = buildAuthoringNavigationTree({
      mapId: simpleObjectModel.mapId,
      model: simpleObjectModel,
      values: { ...testDefaults, simple: { amount: 12, unit: 'POUNDS' } }
    })

    expect(absentComplex.navigationTargets).toEqual([
      expect.objectContaining({ kind: 'step', stepId: 'configuration' })
    ])
    expect(absentComplex.navigationTargets[0]?.ownedFieldPaths).toContain('complex')
    expect(populatedSimple.navigationTargets).toEqual([
      expect.objectContaining({ kind: 'step', stepId: 'configuration' })
    ])
    expect(populatedSimple.navigationTargets).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ fieldPathPrefix: 'simple' })])
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
  it('keeps incomplete step count separate from issues', () => {
    const summaries = toAuthoringRailSummaries({
      hasChanges: false,
      mode: 'create',
      summary: {
        completeCount: 1,
        errorCount: 0,
        incompleteCount: 1,
        stepCount: 2,
        warningCount: 0
      }
    })

    expect(summaries).toEqual([
      expect.objectContaining({
        label: 'steps',
        markerLabel: 'Completed steps',
        status: 'complete',
        value: '1/2'
      }),
      expect.objectContaining({
        label: 'issues',
        markerLabel: 'No issues',
        status: 'complete',
        value: '0'
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
      summary: {
        completeCount: 1,
        errorCount: 0,
        incompleteCount: 0,
        stepCount: 1,
        warningCount: 0
      }
    })

    expect(summaries).toEqual([
      expect.objectContaining({ label: 'steps', status: 'complete', value: '1/1' }),
      expect.objectContaining({ label: 'issues', markerLabel: 'No issues', status: 'complete' }),
      expect.objectContaining({ label: 'status', status: 'complete', value: 'Saved' })
    ])
  })

  it('formats the supplied completion count', () => {
    const summaries = toAuthoringRailSummaries({
      hasChanges: false,
      mode: 'create',
      summary: {
        completeCount: 2,
        errorCount: 0,
        incompleteCount: 0,
        stepCount: 2,
        warningCount: 0
      }
    })

    expect(summaries[0]).toEqual(expect.objectContaining({ value: '2/2' }))
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

  it('marks object groups incomplete when required child fields are missing', async () => {
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
                  presentation: 'inline',
                  visible: true,
                  required: false,
                  hiddenBehavior: 'KEEP',
                  clearPaths: [],
                  authoring: resolveObjectAuthoringMeta('Charges', undefined)
                }
              ]
            }
          ]
        }
      ]
    } satisfies NodeRuntimeResolveResponseDto

    const values = { ...testDefaults, charges: { id: 'charges-1' } }
    const progress = getAuthoringProgress({
      model: await withResolvedScopes(requiredChildGroupModel, values),
      values
    })

    expect(progress.stepStatuses.charges).toBe('incomplete')
    expect(progress.canFinalize).toBe(false)
  })
})

describe('authoring default value helpers', () => {
  it('creates child node defaults through node factories', () => {
    const arrayNode: NodeRuntimeNodeDto = {
      id: 'features',
      path: ['features'],
      label: 'Features',
      kind: 'GROUP',
      groupKind: 'ARRAY',
      childMapId: 'feature',
      presentation: 'inline',
      visible: true,
      required: false,
      hiddenBehavior: 'KEEP',
      clearPaths: [],
      authoring: arrayAuthoring('Features', 'inline')
    }
    const objectNode: NodeRuntimeNodeDto = {
      id: 'cost',
      path: ['cost'],
      label: 'Cost',
      kind: 'GROUP',
      groupKind: 'OBJECT',
      childMapId: 'cost',
      presentation: 'inline',
      visible: true,
      required: false,
      hiddenBehavior: 'KEEP',
      clearPaths: [],
      authoring: resolveObjectAuthoringMeta('Cost', undefined)
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
