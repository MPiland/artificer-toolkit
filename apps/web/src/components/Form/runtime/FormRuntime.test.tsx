import { Button, Stack, Text } from '@mantine/core'
import { screen, within } from '@testing-library/react'
import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildNodeMap, SPELL_NODE_MAP } from '@artificer-toolkit/shared'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { AuthoredFormStepNav } from '../AuthoredFormStepNav'
import {
  applyNodeRuntimeClearPaths,
  AuthoredFormRuntime,
  defaultOptionResolver,
  getNodeRuntimeDebounceMs,
  getRuntimeNodeOptions,
  getRuntimeNodeRequired,
  getRuntimeNodeVisible,
  getStepStatuses,
  NestedCollectionShell,
  requiredNumber,
  requiredString,
  SectionNavigator,
  useAppForm,
  useAuthoredFormUiState,
  validatorsFor
} from '.'

type RuntimeFixture = {
  label: string
  description: string
  level?: number
  notes: string[]
  category?: string
  hiddenText?: string
}

const defaultValues: RuntimeFixture = {
  label: 'Ember Ward',
  description: 'A protective spell.',
  level: 2,
  notes: ['Playtest note'],
  hiddenText: 'Temporary'
}

const runtimeFixtureNodeMap = buildNodeMap<RuntimeFixture>().define('runtimeFixture', ({ map, nodes }) => {
  const section = { id: 'basics', label: 'Basics', order: 10 }
  map
    .set('label', nodes.text(['label'], 'Name', { section, order: 10 }))
    .set('category', nodes.selectSingle(['category'], 'Category', {
      kind: 'INLINE',
      options: []
    }, { section, order: 20 }))
    .set('hiddenText', nodes.text(['hiddenText'], 'Hidden Text', { section, order: 30 }))
})

const resolvedRuntimeFixture: NodeRuntimeResolveResponseDto = {
  mapId: 'runtimeFixture',
  clearPaths: [['hiddenText']],
  sections: [
    {
      id: 'basics',
      label: 'Basics',
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
          options: [{ value: 'arcane', label: 'Arcane' }]
        },
        {
          id: 'hiddenText',
          path: ['hiddenText'],
          label: 'Hidden Text',
          kind: 'INPUT',
          type: 'TEXT',
          visible: false,
          required: false,
          hiddenBehavior: 'CLEAR',
          clearPaths: [['hiddenText']]
        }
      ]
    }
  ]
}

function PrimitiveHarness({ readOnly = false }: { readOnly?: boolean }) {
  const appForm = useAppForm({
    defaultValues,
    onSubmit: () => undefined
  })

  return (
    <appForm.AppForm>
      <appForm.FormStack>
        <appForm.AppField name='label'>
          {(field) => <field.TextField label='Name' readOnly={readOnly} />}
        </appForm.AppField>
        <appForm.AppField name='description'>
          {(field) => <field.TextareaField label='Description' readOnly={readOnly} />}
        </appForm.AppField>
        <appForm.Subscribe selector={(state) => state.values.label}>
          {(label) => <output aria-label='Current name'>{label}</output>}
        </appForm.Subscribe>
      </appForm.FormStack>
    </appForm.AppForm>
  )
}

function SectionHarness() {
  const appForm = useAppForm({
    defaultValues,
    onSubmit: () => undefined
  })
  const formUi = useAuthoredFormUiState({
    initialSectionId: 'basics'
  })

  return (
    <appForm.AppForm>
      <Stack>
        <SectionNavigator
          sections={[
            { id: 'basics', label: 'Basics', order: 10, nodes: [] },
            { id: 'details', label: 'Details', order: 20, nodes: [] }
          ]}
          activeSectionId={formUi.activeSectionId}
          onSectionChange={formUi.setActiveSectionId}
        />
        <Text>{`Active section: ${formUi.activeSectionId}`}</Text>
        <appForm.Subscribe selector={(state) => state.values.label}>
          {(label) => <output aria-label='Current name'>{label}</output>}
        </appForm.Subscribe>
      </Stack>
    </appForm.AppForm>
  )
}

function NestedCollectionHarness({ readOnly = false }: { readOnly?: boolean }) {
  const appForm = useAppForm({
    defaultValues,
    onSubmit: () => undefined
  })

  return (
    <appForm.AppForm>
      <Stack>
        <appForm.AppField name='notes' mode='array'>
          {(field) => (
            <NestedCollectionShell
              field={field}
              label='Note'
              readOnly={readOnly}
              createItem={() => `Note ${field.state.value?.length ?? 0}`}
            />
          )}
        </appForm.AppField>
        <appForm.Subscribe selector={(state) => state.values.notes.length}>
          {(count) => <output aria-label='Note count'>{count}</output>}
        </appForm.Subscribe>
      </Stack>
    </appForm.AppForm>
  )
}

function LockedRuntimeHarness({ onCopy }: { onCopy: () => void }) {
  const appForm = useAppForm({
    defaultValues,
    onSubmit: () => undefined
  })

  return (
    <appForm.AppForm>
      <AuthoredFormRuntime
        form={appForm}
        nodeMap={SPELL_NODE_MAP}
        readOnly
        onCopy={onCopy}
        optionResolver={() => []}
      />
    </appForm.AppForm>
  )
}

function ResolvedRuntimeHarness({ onClearPaths }: { onClearPaths?: (paths: readonly (readonly (string | number)[])[]) => void }) {
  const appForm = useAppForm({
    defaultValues,
    onSubmit: () => undefined
  })

  return (
    <appForm.AppForm>
      <AuthoredFormRuntime
        form={appForm}
        nodeMap={runtimeFixtureNodeMap}
        runtimeModel={resolvedRuntimeFixture}
        onClearPaths={onClearPaths}
      />
    </appForm.AppForm>
  )
}

function ValidationHarness() {
  const appForm = useAppForm({
    defaultValues: {
      label: ''
    },
    onSubmit: () => undefined
  })

  return (
    <appForm.AppForm>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void appForm.handleSubmit()
        }}
      >
        <appForm.AppField
          name='label'
          validators={validatorsFor(requiredString('Name'))}
        >
          {(field) => <field.TextField label='Name' required />}
        </appForm.AppField>
        <Button type='submit'>Save</Button>
      </form>
    </appForm.AppForm>
  )
}

describe('Phase 9.5 form runtime', () => {
  it('updates values through TanStack Form field state', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<PrimitiveHarness />)

    const nameField = screen.getByRole('textbox', { name: 'Name' })
    await user.clear(nameField)
    await user.type(nameField, 'Frost Lace')

    expect(screen.getByLabelText('Current name')).toHaveTextContent('Frost Lace')
  })

  it('renders SSR-style initial values without a global draft store', () => {
    renderWithAppProviders(<PrimitiveHarness />)

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ember Ward')
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('A protective spell.')
  })

  it('changes active sections without mutating form values', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<SectionHarness />)

    await user.click(screen.getByRole('button', { name: 'Details' }))

    expect(screen.getByText('Active section: details')).toBeVisible()
    expect(screen.getByLabelText('Current name')).toHaveTextContent('Ember Ward')
  })

  it('blocks editing in read-only mode', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<PrimitiveHarness readOnly />)

    await user.type(screen.getByRole('textbox', { name: 'Name' }), ' Changed')

    expect(screen.getByLabelText('Current name')).toHaveTextContent('Ember Ward')
  })

  it('adds and removes nested array items through TanStack array APIs', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<NestedCollectionHarness />)

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByLabelText('Note count')).toHaveTextContent('2')

    const firstNote = screen.getByText('Note 1').closest('div')
    expect(firstNote).not.toBeNull()
    await user.click(within(firstNote as HTMLElement).getByRole('button', { name: 'Remove Note 1' }))

    expect(screen.getByLabelText('Note count')).toHaveTextContent('1')
  })

  it('keeps locked master forms read-only while exposing copy wiring', async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn()
    renderWithAppProviders(<LockedRuntimeHarness onCopy={onCopy} />)

    await user.click(screen.getByRole('button', { name: 'Copy to edit' }))

    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('readonly')
  })

  it('resolves inline option groups without a custom option resolver', () => {
    const options = defaultOptionResolver({
      nodeId: 'properties',
      node: {} as never,
      values: { category: 'weapon' },
      source: {
        kind: 'INLINE',
        optionGroups: [
          {
            showIf: { from: 'LOCAL', path: ['category'], op: '=', value: 'weapon' },
            options: [{ code: 'FINESSE', label: 'Finesse' }]
          },
          {
            showIf: { from: 'LOCAL', path: ['category'], op: '=', value: 'armor' },
            options: [{ code: 'HEAVY', label: 'Heavy' }]
          }
        ]
      }
    })

    expect(options).toEqual([{ value: 'FINESSE', label: 'Finesse' }])
  })

  it('uses resolver visibility and clear paths as the active runtime model', async () => {
    const onClearPaths = vi.fn()
    renderWithAppProviders(<ResolvedRuntimeHarness onClearPaths={onClearPaths} />)

    expect(screen.getByRole('textbox', { name: /name/i })).toBeVisible()
    expect(screen.queryByRole('textbox', { name: /hidden text/i })).not.toBeInTheDocument()

    await waitFor(() => {
      expect(onClearPaths).toHaveBeenCalledWith([['hiddenText']])
    })
  })

  it('uses resolver options for select fields', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<ResolvedRuntimeHarness />)

    await user.click(screen.getByRole('textbox', { name: /category/i }))

    expect(await screen.findByText('Arcane')).toBeInTheDocument()
  })

  it('exposes runtime node helpers for custom form layouts', () => {
    expect(getRuntimeNodeRequired(resolvedRuntimeFixture, 'label')).toBe(true)
    expect(getRuntimeNodeVisible(resolvedRuntimeFixture, 'hiddenText')).toBe(false)
    expect(getRuntimeNodeOptions(resolvedRuntimeFixture, 'category', [])).toEqual([
      {
        value: 'arcane',
        label: 'Arcane'
      }
    ])
    expect(getRuntimeNodeOptions(resolvedRuntimeFixture, 'missing', [{ value: 'fallback', label: 'Fallback' }])).toEqual([
      {
        value: 'fallback',
        label: 'Fallback'
      }
    ])
  })

  it('does not silently render empty options for unresolved DATA sources', () => {
    const options = defaultOptionResolver({
      nodeId: 'classes',
      node: {} as never,
      values: defaultValues,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'TABLE',
          table: 'classes'
        }
      }
    })

    expect(options).toEqual([
      {
        value: '__runtime_options_unresolved__',
        label: 'Runtime options unavailable',
        disabled: true
      }
    ])
  })

  it('clears hidden runtime values from draft data', () => {
    expect(applyNodeRuntimeClearPaths(defaultValues, [['hiddenText']])).toEqual({
      values: {
        label: 'Ember Ward',
        description: 'A protective spell.',
        level: 2,
        notes: ['Playtest note']
      },
      clearedPaths: [['hiddenText']]
    })
  })

  it('uses kind-specific runtime debounce defaults', () => {
    expect(getNodeRuntimeDebounceMs('SELECT_SINGLE')).toBe(50)
    expect(getNodeRuntimeDebounceMs('TEXT')).toBe(200)
    expect(getNodeRuntimeDebounceMs(undefined)).toBe(150)
  })

  it('shows TanStack field validation errors through app fields', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<ValidationHarness />)

    await user.click(screen.getByRole('textbox', { name: /name/i }))
    await user.tab()

    expect(await screen.findByText('Name is required.')).toBeVisible()
  })

  it('treats real numbers as valid required numeric values', () => {
    const validateAmount = requiredNumber('Amount')

    expect(validateAmount({ value: 0 })).toBeUndefined()
    expect(validateAmount({ value: 3 })).toBeUndefined()
    expect(validateAmount({ value: undefined })).toBe('Amount is required.')
    expect(validateAmount({ value: Number.NaN })).toBe('Amount is required.')
    expect(validateAmount({ value: '3' })).toBe('Amount is required.')
  })

  it('maps nested field errors to authored form steps', () => {
    expect(getStepStatuses({
      fieldMeta: {
        'label': { isDirty: true },
        'effects[0].invocation.triggerCode': { errors: ['Trigger is required.'] }
      },
      stepFields: {
        info: ['label'],
        effects: ['effects']
      }
    })).toEqual({
      info: 'dirty',
      effects: 'error'
    })
  })

  it('renders breadcrumb step error state for inactive steps', () => {
    const onStepChange = vi.fn()
    renderWithAppProviders(
      <AuthoredFormStepNav
        activeStep='info'
        onStepChange={onStepChange}
        stepStatuses={{ effects: 'error' }}
        steps={[
          { id: 'info', label: 'Info', description: 'Player-facing details' },
          { id: 'effects', label: 'Effects', description: 'Outcomes' }
        ]}
      />
    )

    const effectsStep = screen.getByRole('button', { name: /effects: outcomes, has errors/i })
    expect(effectsStep).toHaveAttribute('aria-invalid', 'true')
  })
})
