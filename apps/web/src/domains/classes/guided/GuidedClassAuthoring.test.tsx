import { render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-form'
import { useMemo, type ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NodeRuntimeCompactResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import type { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { CLASS_CATEGORY } from '@artificer-toolkit/shared/core'
import { authoredRouteStorySystem } from '#domains/authoredRouteStory.fixtures'
import { useAppForm } from '#forms/app-form/AppForm'
import { createInitialSession } from '#forms/layout/authoringSessionState'
import { createEmptyClass } from '../classAuthoring.utils'
import { GuidedClassAuthoring } from './GuidedClassAuthoring'

const mocks = vi.hoisted(() => ({ equipmentOptions: vi.fn(), nodeRuntimeResolve: vi.fn() }))

vi.mock('#app/data/equipment/options', () => ({ getEquipmentOptions: mocks.equipmentOptions }))
vi.mock('#app/data/nodeRuntime/queries', () => ({
  getNodeRuntimeResolve: mocks.nodeRuntimeResolve
}))
vi.mock('#forms/AuthoringArtworkControl', () => ({ AuthoringArtworkControl: () => null }))
vi.mock('#forms/guided/GuidedAuthoringFrame', () => ({
  GuidedAuthoringFrame: ({
    children,
    onNext,
    canContinue
  }: ComponentProps<typeof GuidedAuthoringFrame>) => (
    <>
      {children}
      {onNext ? (
        <button disabled={!canContinue} onClick={onNext}>
          Next
        </button>
      ) : null}
    </>
  )
}))

const parentResponse = {
  mapId: 'class',
  steps: [
    {
      id: 'basics',
      label: 'Basics',
      order: 0,
      sections: [
        {
          id: 'identity',
          label: 'Identity',
          order: 0,
          nodes: [
            {
              id: 'parent',
              path: ['parentClassId'],
              label: 'Parent class',
              visible: true,
              required: true,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              kind: 'INPUT',
              type: 'SELECT_SINGLE',
              options: [{ label: 'Fighter', value: 'fighter-id' }],
              authoring: { exposure: 'author' }
            }
          ]
        }
      ]
    }
  ],
  clearPaths: [],
  scopes: [],
  models: []
} satisfies NodeRuntimeCompactResolveResponseDto

const onStateChange = vi.fn()

function renderHarness(props: ComponentProps<typeof Harness>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider env='test'>
        <Harness {...props} />
      </MantineProvider>
    </QueryClientProvider>
  )
}

const NO_OVERRIDES = {}

function Harness({
  category,
  overrides = NO_OVERRIDES,
  systemId = 'system-5e'
}: {
  category: 'BASE' | 'SUBCLASS'
  overrides?: object
  systemId?: string
}) {
  const defaultValues = useMemo<object>(
    () => ({
      ...createEmptyClass({ systemId }),
      label: 'Test Class',
      category,
      parentClassId: '',
      ...overrides
    }),
    [category, overrides, systemId]
  )
  const form = useAppForm({
    defaultValues,
    onSubmit: async () => undefined
  })
  const session = useMemo(
    () =>
      createInitialSession({
        domain: 'class',
        mode: 'create',
        data: systemId
          ? { system: { id: systemId }, systems: [{ id: systemId }] }
          : { system: null, systems: [] }
      }).authoredSession,
    [systemId]
  )
  if (!session) throw new Error('Expected class authoring session.')
  const values = useSelector(form.store, (state) => state.values)
  return (
    <form.AppForm>
      <GuidedClassAuthoring
        form={form}
        onAdvanced={undefined}
        onStateChange={onStateChange}
        session={session}
        system={authoredRouteStorySystem}
      />
      <output data-testid='values'>{JSON.stringify(values)}</output>
    </form.AppForm>
  )
}

describe('GuidedClassAuthoring native choices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.nodeRuntimeResolve.mockImplementation((input, enabled) =>
      queryOptions({
        queryKey: ['parent-options', input],
        enabled,
        queryFn: async () => parentResponse
      })
    )
    mocks.equipmentOptions.mockImplementation((systemId) =>
      queryOptions({
        queryKey: ['equipment', systemId ?? null],
        enabled: Boolean(systemId),
        queryFn: async () => [{ label: 'Longsword', value: 'longsword-id' }]
      })
    )
  })

  it('uses exact-System native parent options and updates the real form field', async () => {
    const user = userEvent.setup()
    renderHarness({ category: CLASS_CATEGORY.SUBCLASS })
    const parentClass = screen.getByRole('combobox', { name: 'Parent class' })
    await waitFor(() => expect(parentClass).toBeEnabled())
    await user.click(parentClass)
    await waitFor(() => expect(parentClass).toHaveAttribute('aria-expanded', 'true'))
    await user.click(await screen.findByRole('option', { name: 'Fighter' }))
    expect(screen.getByTestId('values')).toHaveTextContent('"parentClassId":"fighter-id"')
    expect(mocks.nodeRuntimeResolve).toHaveBeenCalledWith(
      { mapId: 'class', systemId: 'system-5e', values: { category: CLASS_CATEGORY.SUBCLASS } },
      true
    )
    expect(mocks.equipmentOptions).toHaveBeenCalledWith(undefined)
  })

  it('shows native parent-query failure and keeps the picker disabled', async () => {
    mocks.nodeRuntimeResolve.mockReturnValue(
      queryOptions({
        queryKey: ['parent-error'],
        retry: false,
        queryFn: async () => {
          throw new Error('offline')
        }
      })
    )
    renderHarness({ category: CLASS_CATEGORY.SUBCLASS })
    await waitFor(() =>
      expect(screen.getByText('Parent classes could not be loaded.')).toBeVisible()
    )
    expect(screen.getByRole('combobox', { name: 'Parent class' })).toBeDisabled()
  })

  it('enables exact-System equipment only on its step and updates the real starting item', async () => {
    const user = userEvent.setup()
    renderHarness({ category: CLASS_CATEGORY.BASE })
    expect(mocks.equipmentOptions).toHaveBeenLastCalledWith(undefined)
    expect(mocks.nodeRuntimeResolve).toHaveBeenLastCalledWith(expect.anything(), false)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(mocks.equipmentOptions).toHaveBeenLastCalledWith(undefined)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(mocks.equipmentOptions).toHaveBeenLastCalledWith('system-5e')
    const equipment = screen.getByRole('combobox', { name: 'Starting item' })
    await waitFor(() => expect(equipment).toBeEnabled())
    await user.type(equipment, 'Longsword')
    await user.click(await screen.findByRole('option', { name: 'Longsword' }))
    expect(screen.getByTestId('values')).toHaveTextContent('"equipmentIds":["longsword-id"]')
  })

  describe('preserved advanced content', () => {
    const grant = {
      grantKind: 'PROFICIENCY_GRANT',
      id: 'grant-1',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      level: 'FULL',
      proficiencyKind: 'SKILL'
    }
    const simpleSkill = { ...grant, authoringModeKind: 'SELECTED', skillIds: ['athletics'] }
    const advancedSkill = { ...grant, id: 'grant-2', authoringModeKind: 'ALL' }
    const alert = /Advanced proficiency rules and equipment choices remain preserved/

    async function openEquipmentStep(overrides: object) {
      const user = userEvent.setup()
      renderHarness({ category: CLASS_CATEGORY.BASE, overrides })
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await user.click(screen.getByRole('button', { name: 'Next' }))
    }

    it('flags a class that has advanced proficiency grants', async () => {
      await openEquipmentStep({ proficiencies: [simpleSkill, advancedSkill] })

      expect(screen.getByText(alert)).toBeInTheDocument()
    })

    it('stays quiet for a class with only the simple skill grant', async () => {
      await openEquipmentStep({ proficiencies: [simpleSkill] })

      expect(screen.queryByText(alert)).not.toBeInTheDocument()
    })
  })

  it('does not load parent choices before a System is selected', () => {
    renderHarness({ category: CLASS_CATEGORY.SUBCLASS, systemId: '' })
    expect(mocks.nodeRuntimeResolve).toHaveBeenLastCalledWith(
      { mapId: 'class', systemId: '', values: { category: CLASS_CATEGORY.SUBCLASS } },
      false
    )
    expect(screen.getByRole('combobox', { name: 'Parent class' })).toBeDisabled()
    expect(screen.getByPlaceholderText('Select a System first')).toBeVisible()
  })

  it('shows an equipment-query failure without enabling selection', async () => {
    mocks.equipmentOptions.mockImplementation((systemId) =>
      queryOptions({
        queryKey: ['equipment-error', systemId ?? null],
        enabled: Boolean(systemId),
        retry: false,
        queryFn: async () => {
          throw new Error('offline')
        }
      })
    )
    const user = userEvent.setup()
    renderHarness({ category: CLASS_CATEGORY.BASE })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() =>
      expect(
        screen.getByText('Starting equipment could not be loaded. Please try again later.')
      ).toBeVisible()
    )
    expect(screen.getByRole('combobox', { name: 'Starting item' })).toBeDisabled()
  })
})
