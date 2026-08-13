import { Alert, Switch } from '@mantine/core'
import type { NotificationPreferencesViewProps } from './notificationPreferencesModel'
import * as styles from './notifications.css'

export function NotificationPreferencesView({
  channels,
  error,
  isSaving,
  label,
  onChange
}: NotificationPreferencesViewProps) {
  return (
    <div className={styles.preferencesControls}>
      <Switch
        checked={channels.inApp}
        className={styles.preferenceControl}
        disabled={isSaving}
        label={`${label} in-app notifications`}
        onChange={(event) => onChange?.({ ...channels, inApp: event.currentTarget.checked })}
      />
      <Switch
        checked={channels.email}
        className={styles.preferenceControl}
        disabled={isSaving}
        label={`${label} email notifications`}
        onChange={(event) => onChange?.({ ...channels, email: event.currentTarget.checked })}
      />
      {error ? (
        <Alert color='red' role='alert'>
          {error}
        </Alert>
      ) : null}
    </div>
  )
}
