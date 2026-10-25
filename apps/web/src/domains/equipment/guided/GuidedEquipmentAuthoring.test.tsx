import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  authoredRouteStoryEquipmentParentResponse,
  authoredRouteStorySystem,
  createEditLoaderData
} from '#domains/authoredRouteStory.fixtures'
import { useAppForm } from '#forms/app-form/AppForm'
import { authoredFormFactories } from '#forms/factories/authoredFormFactories'
import { GuidedEquipmentAuthoring } from './GuidedEquipmentAuthoring'

const mocks = vi.hoisted(() => ({ useQuery: vi.fn() }))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: mocks.useQuery
}))
vi.mock('#forms/AuthoringArtworkControl', () => ({ AuthoringArtworkControl: () => null }))
vi.mock('#forms/layout/AuthoringFormContext', () => ({
  useAuthoringForm: () => ({ cancel: vi.fn(), cancelHref: '/equipment', cancelLabel: 'Cancel' })
}))

const session = authoredFormFactories.equipment.createSession?.({
  data: createEditLoaderData('equipment', 'ownedDraft').authoringData,
  mode: 'edit'
})
if (!session) throw new Error('Expected the Equipment draft session.')
const equipmentSession = session

function Harness() {
  const form = useAppForm({ defaultValues: equipmentSession.initialValues })
  return (
    <MantineProvider env='test'>
      <form.AppForm>
        <GuidedEquipmentAuthoring
          form={form}
          session={equipmentSession}
          system={authoredRouteStorySystem}
          onAdvanced={undefined}
          onStateChange={vi.fn()}
        />
        <form.Subscribe selector={(state) => state.values}>
          {(values) => <output data-testid='values'>{JSON.stringify(values)}</output>}
        </form.Subscribe>
      </form.AppForm>
    </MantineProvider>
  )
}

describe('GuidedEquipmentAuthoring', () => {
  it('preserves a variant parent when navigating between Basics and Item details', async () => {
    const parent = authoredRouteStoryEquipmentParentResponse.item
    mocks.useQuery.mockReturnValue({
      data: [{ value: parent.id, label: parent.label }],
      isLoading: false
    })
    const user = userEvent.setup()
    render(<Harness />)
    const initialValues = screen.getByTestId('values').textContent
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('combobox', { name: 'Base item' })).toHaveValue(parent.label)
    expect(screen.getByTestId('values')).toHaveTextContent(initialValues!)
    await user.click(screen.getByRole('combobox', { name: 'Base item' }))
    await user.click(screen.getByRole('option', { name: parent.label }))
    expect(screen.getByRole('combobox', { name: 'Base item' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.click(screen.getByRole('combobox', { name: 'Base item' }))
    await user.click(screen.getByRole('option', { name: parent.label }))
    expect(screen.getByRole('combobox', { name: 'Base item' })).toHaveValue(parent.label)
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('combobox', { name: 'Base item' })).toHaveValue(parent.label)
    expect(screen.getByTestId('values')).toHaveTextContent(initialValues!)
  })
})
