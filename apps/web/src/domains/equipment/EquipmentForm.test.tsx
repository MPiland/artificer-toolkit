import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { EquipmentForm } from './EquipmentForm'
import {
  equipmentRuntimeFixture,
  masterEquipmentResponseFixture,
  ownedVariantEquipmentResponseFixture
} from './equipment.fixtures'

const references = {
  systemId: 'dnd-5e-srd',
  damageTypes: [],
  conditionTypes: [],
  creatures: []
}

describe('EquipmentForm', () => {
  it('renders locked master view as read-only with duplicate affordance', () => {
    renderWithAppProviders(
      <EquipmentForm
        mode='view'
        systemId='dnd-5e-srd'
        userId='user-1'
        references={references}
        response={masterEquipmentResponseFixture}
        resolveRuntime={false}
        runtimeModel={equipmentRuntimeFixture}
        onSubmit={async () => undefined}
        onCopy={() => undefined}
      />
    )

    expect(screen.getByText(/locked for direct editing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate to edit/i })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveAttribute('readonly')
  })

  it('uses variant flow without inventory and contents steps', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <EquipmentForm
        mode='edit'
        systemId='dnd-5e-srd'
        userId='user-1'
        references={references}
        response={ownedVariantEquipmentResponseFixture}
        resolveRuntime={false}
        runtimeModel={equipmentRuntimeFixture}
        onSubmit={async () => undefined}
      />
    )

    expect(screen.queryByRole('button', { name: /inventory/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /contents/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('heading', { level: 2, name: /^rules$/i })).toBeInTheDocument()
  })
})
