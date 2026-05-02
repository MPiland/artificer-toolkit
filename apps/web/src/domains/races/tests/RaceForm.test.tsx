import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { RaceForm } from '../components/RaceForm'
import {
  masterRaceResponseFixture,
  ownedSubraceResponseFixture,
  raceRuntimeFixture
} from '../race.fixtures'

describe('RaceForm', () => {
  it('renders locked master view as read-only with duplicate affordance', () => {
    renderWithAppProviders(
      <RaceForm
        mode='view'
        systemId='dnd-5e-srd'
        userId='user-1'
        response={masterRaceResponseFixture}
        resolveRuntime={false}
        runtimeModel={raceRuntimeFixture}
        onSubmit={async () => undefined}
        onCopy={() => undefined}
      />
    )

    expect(screen.getByText(/locked for direct editing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate to edit/i })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: /category/i })).toHaveAttribute('readonly')
  })

  it('uses subrace content steps without the base ancestry step', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceForm
        mode='edit'
        systemId='dnd-5e-srd'
        userId='user-1'
        response={ownedSubraceResponseFixture}
        resolveRuntime={false}
        runtimeModel={raceRuntimeFixture}
        onSubmit={async () => undefined}
      />
    )

    expect(screen.queryByRole('button', { name: /ancestry/i })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /parent race/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('heading', { level: 2, name: /traits/i })).toBeInTheDocument()
  })
})
