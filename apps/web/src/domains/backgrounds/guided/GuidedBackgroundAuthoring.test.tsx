import { render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query'
import { useMemo, type ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { authoredRouteStorySystem } from '#domains/authoredRouteStory.fixtures'
import { useAppForm } from '#forms/app-form/AppForm'
import { createInitialSession } from '#forms/layout/authoringSessionState'
import { ownedBackgroundFixture } from '../background.fixtures'
import { GuidedBackgroundAuthoring } from './GuidedBackgroundAuthoring'

const mocks = vi.hoisted(() => ({ equipmentOptions: vi.fn() }))

vi.mock('#app/data/equipment/options', () => ({ getEquipmentOptions: mocks.equipmentOptions }))
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

const [fixtureSet] = ownedBackgroundFixture.startingEquipment?.sets ?? []
const selectedItem = {
  id: 'longsword-item',
  order: 1,
  startingEquipmentKind: 'EQUIPMENT',
  selectionKind: 'GRANTED',
  authoringModeKind: 'SELECTED',
  equipmentIds: ['longsword-id'],
  quantity: 3
}
const withItem = {
  ...fixtureSet,
  groups: [
    {
      ...fixtureSet.groups[0],
      options: [{ ...fixtureSet.groups[0].options[0], items: [selectedItem] }]
    }
  ]
}

function Harness({ extraSet }: { extraSet: boolean }) {
  const defaultValues = useMemo<object>(
    () => ({
      ...ownedBackgroundFixture,
      startingEquipment: {
        ...ownedBackgroundFixture.startingEquipment,
        sets: extraSet ? [withItem, { ...withItem, id: 'second-set', order: 2 }] : [withItem]
      }
    }),
    [extraSet]
  )
  const form = useAppForm({ defaultValues, onSubmit: async () => undefined })
  const session = useMemo(
    () =>
      createInitialSession({
        domain: 'background',
        mode: 'create',
        data: { system: { id: 'system-5e' }, systems: [{ id: 'system-5e' }] }
      }).authoredSession,
    []
  )
  if (!session) throw new Error('Expected background authoring session.')
  return (
    <form.AppForm>
      <GuidedBackgroundAuthoring
        form={form}
        onAdvanced={undefined}
        onStateChange={vi.fn()}
        session={session}
        system={authoredRouteStorySystem}
      />
    </form.AppForm>
  )
}

async function openStartingGear(extraSet: boolean) {
  const user = userEvent.setup()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MantineProvider env='test'>
        <Harness extraSet={extraSet} />
      </MantineProvider>
    </QueryClientProvider>
  )
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.click(screen.getByRole('button', { name: 'Next' }))
}

describe('GuidedBackgroundAuthoring starting gear', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.equipmentOptions.mockImplementation((systemId) =>
      queryOptions({
        queryKey: ['equipment', systemId ?? null],
        enabled: Boolean(systemId),
        queryFn: async () => [{ label: 'Longsword', value: 'longsword-id' }]
      })
    )
  })

  it('shows the draft starting item and quantity', async () => {
    await openStartingGear(false)

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Starting item' })).toHaveValue('Longsword')
    )
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toHaveValue('3')
    expect(screen.queryByText(/Additional starting-equipment choices/)).not.toBeInTheDocument()
  })

  it('flags additional starting-equipment choices as preserved', async () => {
    await openStartingGear(true)

    expect(await screen.findByText(/Additional starting-equipment choices/)).toBeInTheDocument()
  })
})
