import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
vi.mock('./NotificationFeed', () => ({ NotificationFeed: () => null }))

import { NotificationUnseenCountContext } from './notificationContext'
import { NotificationDesktopAction, NotificationMobileAction } from './NotificationShellActions'

describe('NotificationDesktopAction', () => {
  it('shares the unseen count across desktop and mobile actions', () => {
    renderWithAppProviders(
      <NotificationUnseenCountContext value={3}>
        <NotificationDesktopAction />
        <NotificationMobileAction />
      </NotificationUnseenCountContext>
    )

    expect(screen.getAllByLabelText('Notifications, 3 new')).toHaveLength(2)
  })
})
