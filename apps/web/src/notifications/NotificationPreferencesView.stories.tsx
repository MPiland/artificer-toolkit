import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import type { NotificationPreferencesViewProps } from './notificationPreferencesModel'
import { NotificationPreferencesView } from './NotificationPreferencesView'
import * as settingsStyles from '#app/settings/settings.css'

const meta = {
  title: 'Settings/Notifications/Preferences',
  component: NotificationPreferencesView,
  decorators: [
    (Story) => (
      <main className={settingsStyles.contentPane}>
        <section aria-labelledby='notification-preferences-story-title'>
          <header className={settingsStyles.pageHeader}>
            <h1 className={settingsStyles.pageTitle} id='notification-preferences-story-title'>
              Preferences
            </h1>
            <p className={settingsStyles.pageDescription}>
              Choose how the Forge looks and works for you.
            </p>
          </header>
          <div className={settingsStyles.settingRow}>
            <div className={settingsStyles.settingCopy}>
              <h3 className={settingsStyles.settingTitle}>Social Hub notifications</h3>
              <p className={settingsStyles.settingDescription}>
                Choose where application and invitation updates reach you.
              </p>
            </div>
            <Story />
          </div>
        </section>
      </main>
    )
  ],
  render: (args) => <StatefulPreferencesStory {...args} />,
  args: {
    channels: { email: true, inApp: true },
    onChange: () => undefined
  }
} satisfies Meta<typeof NotificationPreferencesView>

export default meta

type Story = StoryObj<typeof meta>

export const Enabled: Story = {}

export const EmailDisabled: Story = {
  args: { channels: { email: false, inApp: true } }
}

export const SaveError: Story = {
  args: {
    error: 'Notification preferences could not be saved.'
  }
}

function StatefulPreferencesStory(args: NotificationPreferencesViewProps) {
  const [channels, setChannels] = useState(args.channels)

  return <NotificationPreferencesView {...args} channels={channels} onChange={setChannels} />
}
