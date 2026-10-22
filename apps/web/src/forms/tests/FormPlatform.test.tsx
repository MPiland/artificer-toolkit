import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSelector } from '@tanstack/react-form'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type {
  NodeRuntimeArrayGroupNodeDto,
  NodeRuntimeInputNodeDto,
  NodeRuntimeObjectGroupNodeDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  resolveArrayAuthoringMeta,
  resolveInputAuthoringMeta,
  resolveObjectAuthoringMeta
} from '@artificer-toolkit/shared/maps'
import { AuthoringLayout } from '#forms'
import { useAppForm, withForm } from '#forms/app-form/AppForm'
import { useAuthoringForm } from '#forms/layout/AuthoringFormContext'
import { FormRenderer } from '#forms/rendering/FormRenderer'
import {
  createDefaultAuthoringArrayItem,
  createDefaultAuthoringObjectItem
} from '#forms/rendering/authoringNodeDefaults'
import { Shell, platformNavigation } from '#app/shell'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { wideField } from '../rendering/FormRenderer.css'
import { getRequiredValidators } from '../rendering/FormRenderer.utils'
import { Item as AuthoringRailItem } from '../layout/Steps/Item/Item'
import { withResolvedScopes } from './withResolvedScopes'

// Opening nested effect editors renders the full effect model under jsdom (about 4s alone for the
// deepest journey), so these journeys need more than the default budget when workers share a core.
const NESTED_EFFECT_EDITOR_TIMEOUT_MS = 20_000

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({
    query: vi.fn(async () => ({ values: {}, clearedPaths: [] }))
  })
}))

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
  requiresAttunement?: boolean
  features: Record<string, unknown>[]
  options: Record<string, unknown>[]
  proficiencies: Record<string, unknown>[]
  startingEquipment?: Record<string, unknown>
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
  requiresAttunement: false,
  features: [],
  options: [
    {
      id: 'option-1',
      label: 'Battle Trance',
      description: 'Choose the battle trance benefit.',
      order: 1,
      effects: []
    }
  ],
  proficiencies: [
    {
      id: 'proficiency-1',
      order: 1,
      grantKind: 'PROFICIENCY_GRANT'
    }
  ],
  startingEquipment: {
    id: 'starting-equipment-1',
    sets: [
      {
        id: 'set-1',
        order: 1,
        groups: [
          {
            id: 'group-1',
            order: 1,
            options: [
              {
                id: 'option-1',
                order: 1,
                items: [
                  {
                    id: 'item-1',
                    order: 1,
                    startingEquipmentKind: 'EQUIPMENT',
                    selectionKind: 'GRANTED',
                    quantity: 1,
                    authoringModeKind: 'ALL'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
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

const TestRenderer = FormRenderer<TestFormValues>({
  defaultValues: testFormDefaults
})

const manifestBehaviorDefaults: TestFormValues = {
  ...testFormDefaults,
  effects: [
    {
      id: 'effect-manifest-1',
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED',
        activation: { code: 'ACTION', amount: 1 },
        range: { rangeKind: 'SELF' }
      },
      paths: [
        {
          id: 'manifest-path-1',
          order: 1,
          pathCode: 'ON_USE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'manifest-result-1',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'manifest-outcome-1',
                effectKind: 'MANIFEST',
                manifestKind: 'ZONE',
                attachmentKind: 'SOURCE',
                label: 'Burning Aura',
                behaviors: [
                  {
                    id: 'manifest-behavior-1',
                    order: 1,
                    invocation: {
                      kind: 'ACTION',
                      triggerCode: 'ACTIVATED',
                      activation: { code: 'ACTION', amount: 1 },
                      range: { rangeKind: 'SELF' }
                    },
                    paths: [
                      {
                        id: 'manifest-behavior-path-1',
                        order: 1,
                        pathCode: 'ON_USE',
                        selectionKind: 'FIXED',
                        resultBlock: {
                          id: 'manifest-behavior-result-1',
                          resultKind: 'SINGLE',
                          outcomes: [
                            {
                              id: 'manifest-behavior-damage-1',
                              effectKind: 'DAMAGE',
                              valueKind: 'DICE',
                              scalingKind: 'NONE',
                              diceConfig: '1d4',
                              damageTypeId: 'acid'
                            }
                          ]
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  ]
}

type InputNodeFixture = NodeRuntimeInputNodeDto extends infer TNode
  ? TNode extends NodeRuntimeInputNodeDto
    ? Omit<TNode, 'authoring' | 'hiddenBehavior'> & {
        authoringMeta?: Parameters<typeof resolveInputAuthoringMeta>[0]
      }
    : never
  : never

function inputNode(node: InputNodeFixture): NodeRuntimeInputNodeDto {
  const { authoringMeta, ...rest } = node

  return {
    ...rest,
    hiddenBehavior: 'KEEP',
    authoring: resolveInputAuthoringMeta(authoringMeta)
  }
}

function objectGroupNode(
  node: Omit<NodeRuntimeObjectGroupNodeDto, 'authoring' | 'hiddenBehavior'> & {
    authoringMeta?: Parameters<typeof resolveObjectAuthoringMeta>[1]
  }
): NodeRuntimeObjectGroupNodeDto {
  const { authoringMeta, ...rest } = node

  return {
    ...rest,
    hiddenBehavior: 'KEEP',
    authoring: resolveObjectAuthoringMeta(rest.label, authoringMeta)
  }
}

function arrayGroupNode(
  node: Omit<NodeRuntimeArrayGroupNodeDto, 'authoring' | 'hiddenBehavior'> & {
    authoringMeta?: Parameters<typeof resolveArrayAuthoringMeta>[2]
    mapAuthoring?: Parameters<typeof resolveArrayAuthoringMeta>[3]
  }
): NodeRuntimeArrayGroupNodeDto {
  const { authoringMeta, mapAuthoring, ...rest } = node

  return {
    ...rest,
    hiddenBehavior: 'KEEP',
    authoring: resolveArrayAuthoringMeta(rest.label, rest.presentation, authoringMeta, mapAuthoring)
  }
}

const resolvedModel = {
  mapId: 'test-form',
  clearPaths: [],
  scopes: [],
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
            inputNode({
              id: 'id',
              path: ['id'],
              label: 'ID',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: true,
              clearPaths: [],
              authoringMeta: { exposure: 'system' }
            }),
            inputNode({
              id: 'userId',
              path: ['userId'],
              label: 'User ID',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: false,
              clearPaths: [],
              authoringMeta: { exposure: 'system' }
            }),
            inputNode({
              id: 'systemId',
              path: ['systemId'],
              label: 'System ID',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: true,
              clearPaths: [],
              authoringMeta: { exposure: 'system' }
            }),
            inputNode({
              id: 'label',
              path: ['label'],
              label: 'Name',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: true,
              clearPaths: []
            }),
            inputNode({
              id: 'order',
              path: ['order'],
              label: 'Order',
              kind: 'INPUT',
              type: 'NUMBER',
              visible: true,
              required: true,
              clearPaths: [],
              authoringMeta: { exposure: 'system' }
            }),
            inputNode({
              id: 'quote',
              path: ['quote'],
              label: 'Quote',
              kind: 'INPUT',
              type: 'RICH_TEXT',
              visible: true,
              required: false,
              clearPaths: []
            }),
            inputNode({
              id: 'description',
              path: ['description'],
              label: 'Description',
              kind: 'INPUT',
              type: 'RICH_TEXT',
              visible: true,
              required: false,
              clearPaths: []
            }),
            inputNode({
              id: 'category',
              path: ['category'],
              label: 'Category',
              kind: 'INPUT',
              type: 'SELECT_SINGLE',
              visible: true,
              required: false,
              clearPaths: [],
              options: [{ value: 'spell', label: 'Spell' }]
            }),
            inputNode({
              id: 'notes',
              path: ['notes'],
              label: 'Notes',
              kind: 'INPUT',
              type: 'RICH_TEXT',
              visible: true,
              required: false,
              clearPaths: []
            }),
            inputNode({
              id: 'requiresAttunement',
              path: ['requiresAttunement'],
              label: 'Requires Attunement',
              kind: 'INPUT',
              type: 'TOGGLE',
              visible: true,
              required: false,
              clearPaths: []
            }),
            inputNode({
              id: 'hiddenText',
              path: ['hiddenText'],
              label: 'Hidden Text',
              kind: 'INPUT',
              type: 'TEXT',
              visible: false,
              required: false,
              clearPaths: []
            }),
            arrayGroupNode({
              id: 'features',
              path: ['features'],
              label: 'Features',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'feature',
              presentation: 'inline',
              visible: true,
              required: false,
              clearPaths: []
            })
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
            inputNode({
              id: 'category',
              path: ['category'],
              label: 'Category',
              kind: 'INPUT',
              type: 'SELECT_SINGLE',
              visible: true,
              required: false,
              clearPaths: [],
              options: [{ value: 'spell', label: 'Spell' }]
            })
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
            arrayGroupNode({
              id: 'paths',
              path: ['paths'],
              label: 'Outcome Paths',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'effectPath',
              presentation: 'focused',
              visible: true,
              required: false,
              clearPaths: [],
              mapAuthoring: { collection: { rowSummary: 'effect-path' } }
            })
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
            arrayGroupNode({
              id: 'effects',
              path: ['effects'],
              label: 'Effects',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'effect',
              presentation: 'focused',
              visible: true,
              required: false,
              clearPaths: [],
              mapAuthoring: { collection: { rowSummary: 'effect' } }
            })
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
            objectGroupNode({
              id: 'grants',
              path: ['grants'],
              label: 'Grants',
              kind: 'GROUP',
              groupKind: 'OBJECT',
              childMapId: 'featureGrants',
              presentation: 'inline',
              visible: true,
              required: false,
              clearPaths: []
            })
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const optionRowsResolvedModel = {
  ...resolvedModel,
  steps: [
    {
      ...resolvedModel.steps[0],
      sections: [
        {
          ...resolvedModel.steps[0].sections[0],
          nodes: [
            arrayGroupNode({
              id: 'options',
              path: ['options'],
              label: 'Options',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'option',
              presentation: 'inline',
              visible: true,
              required: false,
              clearPaths: []
            })
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const directGrantRowsResolvedModel = {
  ...resolvedModel,
  steps: [
    {
      ...resolvedModel.steps[0],
      sections: [
        {
          ...resolvedModel.steps[0].sections[0],
          nodes: [
            arrayGroupNode({
              id: 'proficiencies',
              path: ['proficiencies'],
              label: 'Proficiencies',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'proficiencyGrant',
              presentation: 'inline',
              visible: true,
              required: false,
              clearPaths: []
            })
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

const startingEquipmentResolvedModel = {
  ...resolvedModel,
  steps: [
    {
      ...resolvedModel.steps[0],
      sections: [
        {
          ...resolvedModel.steps[0].sections[0],
          nodes: [
            objectGroupNode({
              id: 'startingEquipment',
              path: ['startingEquipment'],
              label: 'Starting Equipment',
              kind: 'GROUP',
              groupKind: 'OBJECT',
              childMapId: 'startingEquipment',
              presentation: 'inline',
              visible: true,
              required: false,
              clearPaths: []
            })
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
            arrayGroupNode({
              id: 'effects',
              path: ['effects'],
              label: 'Effects',
              kind: 'GROUP',
              groupKind: 'ARRAY',
              childMapId: 'effect',
              presentation: 'focused',
              visible: true,
              required: false,
              clearPaths: [],
              mapAuthoring: { collection: { rowSummary: 'effect' } }
            })
          ]
        },
        {
          id: 'usage',
          label: 'Usage',
          order: 20,
          nodes: [
            objectGroupNode({
              id: 'charges',
              path: ['charges'],
              label: 'Charges',
              kind: 'GROUP',
              groupKind: 'OBJECT',
              childMapId: 'charges',
              presentation: 'inline',
              visible: true,
              required: false,
              clearPaths: []
            })
          ]
        },
        {
          id: 'restrictions',
          label: 'Restrictions',
          order: 30,
          nodes: [
            objectGroupNode({
              id: 'restrictions',
              path: ['restrictions'],
              label: 'Restrictions',
              kind: 'GROUP',
              groupKind: 'OBJECT',
              childMapId: 'facet',
              presentation: 'inline',
              visible: true,
              required: false,
              clearPaths: []
            })
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

function TestForm({
  canDelete = false,
  canSaveDraft = false,
  defaultValues = testFormDefaults,
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
  defaultValues?: TestFormValues
  hasActiveDraft?: boolean
  isDraft?: boolean
  mode?: 'create' | 'view' | 'edit'
  model?: NodeRuntimeResolveResponseDto
  onDelete?: () => void
  onSaveDraft?: () => void
  onSubmit?: (value: TestFormValues) => void
}) {
  const clonedDefaultValues = useMemo(() => structuredClone(defaultValues), [defaultValues])
  const clonedModel = useMemo(() => structuredClone(model), [model])
  const form = useAppForm({
    defaultValues: clonedDefaultValues,
    onSubmit: async ({ value }) => onSubmit(value)
  })

  return (
    <AuthoringLayout>
      <form.AppForm>
        <TestFormContent
          canDelete={canDelete}
          canSaveDraft={canSaveDraft}
          hasActiveDraft={hasActiveDraft}
          isDraft={isDraft}
          form={form}
          mode={mode}
          model={clonedModel}
          onDelete={onDelete}
          onSaveDraft={onSaveDraft}
        />
      </form.AppForm>
    </AuthoringLayout>
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
    form,
    hasActiveDraft,
    isDraft,
    mode,
    model,
    onDelete,
    onSaveDraft
  }) {
    const { providedModel, updateAuthoringFormActions, updateAuthoringFormState } =
      useAuthoringForm()
    const formValues = useSelector(form.store, (state) => state.values)
    const [resolvedModel, setResolvedModel] = useState<NodeRuntimeResolveResponseDto>()

    useEffect(() => {
      let current = true
      void withResolvedScopes(model, formValues).then((resolved) => {
        if (current) setResolvedModel(resolved)
      })
      return () => {
        current = false
      }
    }, [formValues, model])

    const statePatch = useMemo(
      () => ({
        canDelete,
        canSaveDraft,
        deleteLabel: 'Delete',
        hasActiveDraft,
        isDraft,
        authoringKind: 'authored-form' as const,
        mapId: 'test-form',
        mode,
        providedModel: resolvedModel,
        readOnly: mode === 'view',
        resolveModel: false,
        subjectKindLabel: 'Test Form',
        subjectLabel: 'Test Form',
        systemId: 'system-1'
      }),
      [canDelete, canSaveDraft, hasActiveDraft, isDraft, mode, resolvedModel]
    )
    const actions = useMemo(
      () => ({
        onActivate: () => form.handleSubmit(),
        onDelete,
        onSaveDraft
      }),
      [form, onDelete, onSaveDraft]
    )

    useEffect(() => {
      updateAuthoringFormState(statePatch)
    }, [statePatch, updateAuthoringFormState])

    useEffect(() => {
      updateAuthoringFormActions(actions)
    }, [actions, updateAuthoringFormActions])

    if (!providedModel) return null

    return (
      <>
        <button type='button' onClick={() => void form.handleSubmit()}>
          Submit
        </button>
        <TestRenderer form={form} />
      </>
    )
  }
})

async function renderForm(ui: ReactElement) {
  const result = render(ui)
  await screen.findByRole('button', { name: 'Submit' }, { timeout: 10_000 })
  return result
}

describe('authoring form platform', () => {
  it('accepts cantrip zero in required numeric selects', () => {
    expect(getRequiredValidators('SELECT_NUMBER', 'Level').onSubmit({ value: 0 })).toBeUndefined()
  })

  it('renders visible resolved fields and skips hidden fields', async () => {
    await renderForm(
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
    expect(screen.getByRole('switch', { name: /requires attunement/i })).toBeInTheDocument()
    const actionBar = screen.getByTestId('authoring-action-bar')
    expect(document.getElementById('authoring-form')).toBeInTheDocument()
    expect(actionBar).toBeInTheDocument()
  })

  it('renders rich text and prose fields as full-width rows', async () => {
    await renderForm(
      <TestRouterProvider>
        <TestForm />
      </TestRouterProvider>
    )

    expect(screen.getByText('Quote').closest(`.${wideField}`)).not.toBeNull()
    expect(screen.getByText('Description').closest(`.${wideField}`)).not.toBeNull()
    expect(screen.getByText('Notes').closest(`.${wideField}`)).not.toBeNull()
  })

  it('shows the canonical fallback title and save status in the compact header', async () => {
    const { rerender } = await renderForm(
      <TestRouterProvider>
        <TestForm />
      </TestRouterProvider>
    )

    expect(screen.queryByLabelText(/current status:/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Untitled Item' })).toBeInTheDocument()
    expect(screen.getAllByText('Saved').length).toBeGreaterThan(0)

    rerender(
      <TestRouterProvider>
        <TestForm isDraft />
      </TestRouterProvider>
    )

    expect(screen.queryByLabelText(/current status:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/the active test form stays unchanged/i)).not.toBeInTheDocument()

    rerender(
      <TestRouterProvider>
        <TestForm mode='create' />
      </TestRouterProvider>
    )

    expect(screen.queryByLabelText(/current status:/i)).not.toBeInTheDocument()
  })

  it('updates values through TanStack Form fields', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    await renderForm(
      <TestRouterProvider>
        <TestForm onSubmit={onSubmit} />
      </TestRouterProvider>
    )

    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Fire Lace')
    const requiresAttunement = screen.getByRole('switch', { name: /requires attunement/i })
    await user.click(requiresAttunement)
    await waitFor(() => expect(requiresAttunement).toBeChecked())
    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Fire Lace',
        requiresAttunement: true
      })
    )
  })

  it('does not clear hidden branch values after an unrelated text edit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const model: NodeRuntimeResolveResponseDto = structuredClone(resolvedModel)
    model.clearPaths = [['notes']]
    const notesNode = model.steps[0]?.sections[0]?.nodes.find((node) => node.id === 'notes')
    if (!notesNode) throw new Error('Expected the Notes node in the test model.')
    notesNode.visible = false

    await renderForm(
      <TestRouterProvider>
        <TestForm
          defaultValues={{ ...testFormDefaults, notes: 'Keep this note.' }}
          model={model}
          onSubmit={onSubmit}
        />
      </TestRouterProvider>
    )

    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Fire Lace')
    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Keep this note.' }))
  })

  it('shows registered delete actions in the header', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()

    await renderForm(
      <TestRouterProvider>
        <TestForm canDelete onDelete={onDelete} />
      </TestRouterProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /more authoring actions/i }))
    await user.click(await screen.findByRole('menuitem', { name: /^delete$/i }, { timeout: 2_500 }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('enables save draft only after form changes', async () => {
    const user = userEvent.setup()
    const onSaveDraft = vi.fn()

    await renderForm(
      <TestRouterProvider>
        <TestForm canSaveDraft onSaveDraft={onSaveDraft} />
      </TestRouterProvider>
    )

    const saveDraftButton = screen.getByRole('button', { name: /save draft/i })
    expect(saveDraftButton).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Fire Lace')

    expect(saveDraftButton).toBeEnabled()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    await user.click(saveDraftButton)
    expect(onSaveDraft).toHaveBeenCalledTimes(1)
  })

  it('uses selected outcome path labels for path rows', async () => {
    await renderForm(
      <TestRouterProvider>
        <TestForm model={outcomePathResolvedModel} />
      </TestRouterProvider>
    )

    expect(screen.getAllByText('On Save Failure').length).toBeGreaterThan(0)
    expect(screen.queryByText('Outcome Path 1')).not.toBeInTheDocument()
  })

  it('keeps nested editors open when editing an outcome path range override', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const defaultValues = structuredClone(testFormDefaults)
    defaultValues.paths = [
      {
        id: 'path-1',
        order: 1,
        pathCode: 'ON_SAVE_FAIL',
        selectionKind: 'FIXED',
        rangeOverride: { rangeKind: 'SELF' }
      }
    ]

    await renderForm(
      <TestRouterProvider>
        <TestForm
          defaultValues={defaultValues}
          model={outcomePathResolvedModel}
          onSubmit={onSubmit}
        />
      </TestRouterProvider>
    )

    const workspaceCount = getEditorWorkspaces().length
    await user.click(getFormContent().getByRole('button', { name: /^open on save failure$/i }))

    expect(getEditorWorkspaces()).toHaveLength(workspaceCount)
    expect(await screen.findByRole('combobox', { name: /outcome path/i })).toBeInTheDocument()
    expect(screen.getAllByRole('combobox', { name: /selection model/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('combobox', { name: /range kind/i }).length).toBeGreaterThan(0)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders effect rows and outcome paths inline on the owning page', async () => {
    const user = userEvent.setup()
    const onSaveDraft = vi.fn()

    await renderForm(
      <TestRouterProvider>
        <TestForm canSaveDraft model={effectResolvedModel} onSaveDraft={onSaveDraft} />
      </TestRouterProvider>
    )

    const saveDraftButton = screen.getByRole('button', { name: /save draft/i })
    const editor = getFormContent()
    expect(saveDraftButton).toBeDisabled()
    const workspaceCount = getEditorWorkspaces().length
    const effectEditorButton = editor.getByRole('button', { name: /^open activated$/i })
    await user.click(effectEditorButton)

    expect(getEditorWorkspaces()).toHaveLength(workspaceCount)
    expect(screen.getByRole('combobox', { name: /trigger/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^on save failure$/i }))
    expect(getEditorWorkspaces()).toHaveLength(workspaceCount)
    expect(await screen.findByRole('combobox', { name: /outcome path/i })).toBeInTheDocument()
    expect(screen.getAllByRole('combobox', { name: /selection model/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('combobox', { name: /range kind/i }).length).toBeGreaterThan(0)
    expect(screen.getByText('Outcomes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^damage$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove activation/i })).not.toBeInTheDocument()
    expect(saveDraftButton).toBeDisabled()
  })

  it(
    'renders manifest behavior outcome paths inline inside the outcome editor',
    async () => {
      const user = userEvent.setup()

      await renderForm(
        <TestRouterProvider>
          <TestForm defaultValues={manifestBehaviorDefaults} model={effectResolvedModel} />
        </TestRouterProvider>
      )

      const editor = getFormContent()
      await user.click(editor.getByRole('button', { name: /^open activated$/i }))

      const workspaceCount = getEditorWorkspaces().length
      await user.click(screen.getByRole('button', { name: /^on use$/i }))
      const burningAuraButton = screen.getByRole('button', { name: /^burning aura$/i })
      expect(burningAuraButton).toHaveAttribute('aria-haspopup', 'dialog')
      await user.click(burningAuraButton)
      expect((await screen.findAllByRole('button', { name: /^cancel$/i })).length).toBeGreaterThan(
        0
      )
      const behaviorButton = screen.getByRole('button', { name: /^behavior 1$/i })
      if (behaviorButton.getAttribute('aria-expanded') === 'false') {
        await user.click(behaviorButton)
      }
      const behaviorPathButton = screen
        .getAllByRole('button', { name: /on use/i })
        .find((button) => button.getAttribute('aria-expanded') === 'false')
      if (behaviorPathButton) await user.click(behaviorPathButton)

      expect(getEditorWorkspaces()).toHaveLength(workspaceCount)
      expect(await screen.findByRole('combobox', { name: /behavior path/i })).toBeInTheDocument()
      expect(screen.getAllByRole('combobox', { name: /selection model/i }).length).toBeGreaterThan(
        0
      )
      expect(screen.getAllByText('Outcomes').length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: /^damage$/i })).toBeInTheDocument()
    },
    NESTED_EFFECT_EDITOR_TIMEOUT_MS
  )

  it(
    'removes effect-owned optional sections without leaving the inline effect row',
    async () => {
      const user = userEvent.setup()

      await renderForm(
        <TestRouterProvider>
          <TestForm model={effectResolvedModel} />
        </TestRouterProvider>
      )

      const editor = getFormContent()
      const workspaceCount = getEditorWorkspaces().length
      await user.click(editor.getByRole('button', { name: /^open activated$/i }))
      await user.click(screen.getByRole('button', { name: /^on save failure$/i }))
      await user.click(await screen.findByRole('button', { name: /remove range override/i }))
      expect(
        await screen.findByRole('dialog', { name: /remove range override/i })
      ).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /^remove$/i }))
      expect(getEditorWorkspaces()).toHaveLength(workspaceCount)
      expect(screen.getByRole('button', { name: /^on save failure$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add range override/i })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /remove range override/i })
      ).not.toBeInTheDocument()
    },
    NESTED_EFFECT_EDITOR_TIMEOUT_MS
  )

  it('returns to the empty effects overview after removing the active effect', async () => {
    const user = userEvent.setup()

    await renderForm(
      <TestRouterProvider>
        <TestForm model={effectResolvedModel} />
      </TestRouterProvider>
    )

    await user.click(getFormContent().getByRole('button', { name: /^open activated$/i }))
    await user.click(screen.getByRole('button', { name: /^remove activated$/i }))

    expect(await screen.findByText('No effects added yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^add effect$/i })).toBeInTheDocument()
    const actionBar = within(screen.getByTestId('authoring-action-bar'))
    expect(actionBar.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument()
    expect(actionBar.getByRole('button', { name: /^activate$/i })).toBeEnabled()
  })

  it('shows absent charges and empty restrictions as add actions only', async () => {
    await renderForm(
      <TestRouterProvider>
        <TestForm
          defaultValues={{ ...testFormDefaults, restrictions: undefined }}
          model={mechanicsResolvedModel}
        />
      </TestRouterProvider>
    )

    expect(screen.getByRole('button', { name: /^add charges$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^add restrictions$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit charges/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit restrictions/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove restrictions/i })).not.toBeInTheDocument()
    expect(screen.getAllByText(/^Effects$/).length).toBeGreaterThan(0)
  })

  it('names restriction removal actions and confirmations by what they remove', async () => {
    const user = userEvent.setup()
    await renderForm(
      <TestRouterProvider>
        <TestForm
          defaultValues={{
            ...testFormDefaults,
            restrictions: {
              id: 'restrictions-1',
              groups: [
                {
                  id: 'restriction-option-1',
                  order: 0,
                  contexts: [
                    {
                      id: 'restriction-condition-1',
                      order: 0,
                      subject: 'CHARACTER',
                      conditions: [
                        {
                          id: 'restriction-predicate-1',
                          order: 0,
                          kind: 'PREDICATE',
                          constraint: 'INCLUDE',
                          predicateCode: 'WHILE_SOURCE_EQUIPPED'
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }}
          model={mechanicsResolvedModel}
        />
      </TestRouterProvider>
    )

    expect(screen.getByRole('button', { name: /^remove option$/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^remove condition$/i }))

    const dialog = await screen.findByRole('dialog', { name: /remove this condition/i })
    expect(within(dialog).getByText(/character condition/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /^remove condition$/i })).toBeInTheDocument()
  })

  it('renders feature grants inline with nested add grant actions', async () => {
    const user = userEvent.setup()

    await renderForm(
      <TestRouterProvider>
        <TestForm model={grantsResolvedModel} />
      </TestRouterProvider>
    )

    expect(screen.queryByRole('button', { name: /edit grants/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^add grants$/i }))
    await user.click(await screen.findByRole('button', { name: /^add modifier grants$/i }))

    expect(screen.getByRole('button', { name: /^\+1 maximum hit points$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit grants/i })).not.toBeInTheDocument()
  })

  it('renders option rows inline instead of opening a separate editor first', async () => {
    const user = userEvent.setup()

    await renderForm(
      <TestRouterProvider>
        <TestForm model={optionRowsResolvedModel} />
      </TestRouterProvider>
    )

    const workspaceCount = getEditorWorkspaces().length
    await user.click(screen.getByRole('button', { name: /^battle trance$/i }))

    expect(getEditorWorkspaces()).toHaveLength(workspaceCount)
    expect(await screen.findByRole('textbox', { name: /label/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit battle trance/i })).not.toBeInTheDocument()
  })

  it('renders direct grant arrays inline across authored domains', async () => {
    const user = userEvent.setup()

    await renderForm(
      <TestRouterProvider>
        <TestForm model={directGrantRowsResolvedModel} />
      </TestRouterProvider>
    )

    const workspaceCount = getEditorWorkspaces().length
    await user.click(getFormContent().getByRole('button', { name: /^proficiency 1$/i }))

    expect(getEditorWorkspaces()).toHaveLength(workspaceCount)
    expect(screen.queryByRole('button', { name: /edit proficiency 1/i })).not.toBeInTheDocument()
  })

  it('renders starting equipment rows inline on the owning step', async () => {
    const user = userEvent.setup()

    await renderForm(
      <TestRouterProvider>
        <TestForm model={startingEquipmentResolvedModel} />
      </TestRouterProvider>
    )

    const workspaceCount = getEditorWorkspaces().length
    const editor = getFormContent()
    await user.click(await editor.findByRole('button', { name: /^set 1$/i }))

    expect(getEditorWorkspaces()).toHaveLength(workspaceCount)
    expect(await screen.findByText('Group 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^group 1$/i }))
    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /edit starting equipment/i })
    ).not.toBeInTheDocument()
  })

  it('resets only the current step fields', async () => {
    const user = userEvent.setup()

    await renderForm(
      <TestRouterProvider>
        <TestForm model={multiStepResolvedModel} />
      </TestRouterProvider>
    )

    const nameInput = screen.getByRole('textbox', { name: /name/i })
    const resetActionsButton = screen.getByRole('button', { name: /reset actions/i })
    await user.click(resetActionsButton)
    const resetStepButton = await screen.findByLabelText(/reset step/i)

    expect(resetStepButton).toBeDisabled()

    await user.click(resetActionsButton)
    await user.type(nameInput, 'Fire Lace')
    await user.click(resetActionsButton)
    expect(await screen.findByLabelText(/reset step/i)).toBeEnabled()

    await user.click(screen.getByRole('link', { name: /^next$/i }))

    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument()
    await user.click(resetActionsButton)
    expect(await screen.findByLabelText(/reset step/i)).toBeDisabled()

    await user.click(screen.getByRole('link', { name: /^back$/i }))
    await user.click(resetActionsButton)
    const enabledResetStepButton = await screen.findByLabelText(/reset step/i)
    expect(enabledResetStepButton).toBeEnabled()

    await user.click(enabledResetStepButton)

    await waitFor(() => expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue(''))
    await user.click(resetActionsButton)
    expect(await screen.findByLabelText(/reset step/i)).toBeDisabled()
  })

  it('uses the structure rail for direct step navigation', async () => {
    const user = userEvent.setup()

    await renderForm(
      <TestRouterProvider>
        <Shell currentPath='/forms/fire-lace/edit' navigation={platformNavigation}>
          <TestForm canSaveDraft model={multiStepResolvedModel} />
        </Shell>
      </TestRouterProvider>
    )

    const saveDraftButton = screen.getByRole('button', { name: /save draft/i })
    expect(screen.queryByLabelText('Current section')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /current step path/i })).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /authoring steps/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^back$/i })).toBeDisabled()
    expect(saveDraftButton).toBeDisabled()

    await user.click(screen.getByRole('link', { name: /details/i }))

    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /name/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^back$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    expect(saveDraftButton).toBeDisabled()
  })

  it('exposes expandable rail relationships to assistive technology', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider>
        <AuthoringRailItem
          item={{
            id: 'mechanics',
            label: 'Mechanics',
            children: [{ id: 'effects', label: 'Effects' }]
          }}
        />
      </TestRouterProvider>
    )

    const trigger = screen.getByRole('button', { name: /^collapse mechanics$/i })
    const controlledId = trigger.getAttribute('aria-controls')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(controlledId).toBeTruthy()
    expect(document.getElementById(controlledId!)).toBeInTheDocument()

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('creates nested defaults from child map ids', () => {
    const featureNode = resolvedModel.steps[0].sections[0].nodes.find(
      (node) => node.id === 'features'
    )

    if (!featureNode || featureNode.kind !== 'GROUP' || featureNode.groupKind !== 'ARRAY') {
      throw new Error('Expected the features node to be an array group.')
    }
    expect(createDefaultAuthoringArrayItem(featureNode, 0)).toEqual(
      expect.objectContaining({
        label: '',
        order: 1
      })
    )
    expect(
      createDefaultAuthoringArrayItem(
        arrayGroupNode({
          id: 'senses',
          path: ['senses'],
          label: 'Senses',
          kind: 'GROUP',
          groupKind: 'ARRAY',
          childMapId: 'creatureSense',
          presentation: 'inline',
          visible: true,
          required: false,
          clearPaths: []
        }),
        0
      )
    ).toEqual({
      senseDefinitionId: '',
      range: { id: expect.any(String), rangeKind: 'DISTANCE', amount: 30, unit: 'FEET' }
    })
    expect(
      createDefaultAuthoringObjectItem(
        objectGroupNode({
          id: 'cost',
          path: ['cost'],
          label: 'Cost',
          kind: 'GROUP',
          groupKind: 'OBJECT',
          childMapId: 'cost',
          presentation: 'inline',
          visible: true,
          required: false,
          clearPaths: []
        })
      )
    ).toEqual({
      amount: 0,
      currencyId: ''
    })
    expect(
      createDefaultAuthoringObjectItem(
        objectGroupNode({
          id: 'context',
          path: ['context'],
          label: 'Character Requirement',
          kind: 'GROUP',
          groupKind: 'OBJECT',
          childMapId: 'characterFacetContext',
          presentation: 'inline',
          visible: true,
          required: false,
          clearPaths: []
        })
      )
    ).toEqual({
      id: expect.any(String),
      order: 1,
      subject: 'CHARACTER',
      conditions: [
        {
          id: expect.any(String),
          order: 1,
          kind: 'PREDICATE',
          constraint: 'INCLUDE'
        }
      ]
    })
    expect(
      createDefaultAuthoringArrayItem(
        arrayGroupNode({
          id: 'conditions',
          path: ['conditions'],
          label: 'Conditions',
          kind: 'GROUP',
          groupKind: 'ARRAY',
          childMapId: 'facetCondition',
          presentation: 'inline',
          visible: true,
          required: false,
          clearPaths: []
        }),
        0
      )
    ).toEqual({
      id: expect.any(String),
      order: 1,
      kind: 'PREDICATE',
      constraint: 'INCLUDE'
    })
  })
})

function getEditorWorkspaces() {
  return screen
    .queryAllByRole('region')
    .filter((region) => within(region).queryByRole('button', { name: /close editor/i }) != null)
}

function getFormContent() {
  return within(screen.getByTestId('authoring-form-content'))
}
