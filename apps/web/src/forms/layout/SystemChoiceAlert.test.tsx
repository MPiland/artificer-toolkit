import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SystemListResponseDto } from '@artificer-toolkit/schema/api/systems'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SystemChoiceAlert } from './SystemChoiceAlert'

type SearchUpdater = (previous: Record<string, unknown>) => Record<string, unknown>

const navigate = vi.hoisted(() => vi.fn<(options: { search: SearchUpdater }) => void>())

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate
}))

const systems = [
  { id: 'system-a', label: 'System A' },
  { id: 'system-b', label: 'System B' }
] as SystemListResponseDto

describe('SystemChoiceAlert', () => {
  beforeEach(() => navigate.mockReset())

  it('says a System is required when none exist', () => {
    renderWithAppProviders(<SystemChoiceAlert subjectPlural='spells' systems={[]} />)

    expect(screen.getByText('A system is required before creating spells.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('carries the chosen System in the route search instead of picking one', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<SystemChoiceAlert subjectPlural='spells' systems={systems} />)

    expect(navigate).not.toHaveBeenCalled()
    await user.click(screen.getByRole('combobox', { name: 'Choose the system for these spells' }))
    await user.click(await screen.findByRole('option', { name: 'System B' }))

    const { search } = navigate.mock.calls[0][0]
    expect(search({ experience: 'guided' })).toEqual({ experience: 'guided', system: 'system-b' })
  })
})
