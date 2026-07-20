import { Menu } from '@mantine/core'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SentryFeedbackMenuItem } from './SentryFeedbackMenuItem'

const mocks = vi.hoisted(() => ({
  createForm: vi.fn(),
  getFeedback: vi.fn(),
  isSentryConfigured: vi.fn()
}))

vi.mock('#app/observability/sentry.config', () => ({
  isSentryConfigured: mocks.isSentryConfigured
}))

vi.mock('@sentry/tanstackstart-react', () => ({
  getFeedback: mocks.getFeedback
}))

describe('SentryFeedbackMenuItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isSentryConfigured.mockReturnValue(true)
  })

  it('opens and removes the opt-in feedback form', async () => {
    const user = userEvent.setup()
    const dialog = {
      appendToDom: vi.fn(),
      close: vi.fn(),
      el: {},
      open: vi.fn(),
      removeFromDom: vi.fn()
    }
    mocks.createForm.mockResolvedValue(dialog)
    mocks.getFeedback.mockReturnValue({ createForm: mocks.createForm })
    renderFeedbackItem()

    await user.click(screen.getByRole('menuitem', { name: 'Send feedback' }))

    expect(dialog.appendToDom).toHaveBeenCalledOnce()
    expect(dialog.open).toHaveBeenCalledOnce()

    const options = mocks.createForm.mock.calls[0]?.[0]
    options?.onFormClose?.()
    expect(dialog.removeFromDom).toHaveBeenCalledOnce()
  })

  it('stays out of the account menu when Sentry is not configured', () => {
    mocks.isSentryConfigured.mockReturnValue(false)

    renderFeedbackItem()

    expect(screen.queryByRole('menuitem', { name: 'Send feedback' })).not.toBeInTheDocument()
  })
})

function renderFeedbackItem() {
  return renderWithAppProviders(
    <Menu opened>
      <Menu.Target>
        <button type='button'>Account</button>
      </Menu.Target>
      <Menu.Dropdown>
        <SentryFeedbackMenuItem />
      </Menu.Dropdown>
    </Menu>
  )
}
