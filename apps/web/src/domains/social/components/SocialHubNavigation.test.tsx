import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SocialHubNavigation } from './SocialHubNavigation'

describe('SocialHubNavigation', () => {
  it('changes views from the mobile navigation drawer', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    renderWithAppProviders(<SocialHubNavigation view='hosting' onChange={onChange} />)

    expect(screen.getByRole('tab', { name: 'Hosting' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('button', { name: 'Hosting' }))

    const dialog = await screen.findByRole('dialog', { name: 'Social Hub views' })
    expect(within(dialog).getByRole('button', { name: 'Hosting' })).toHaveAttribute(
      'aria-current',
      'page'
    )

    await user.click(within(dialog).getByRole('button', { name: 'My applications' }))

    expect(onChange).toHaveBeenCalledWith('applications')
  })
})
