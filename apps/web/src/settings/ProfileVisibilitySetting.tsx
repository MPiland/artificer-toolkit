import { SegmentedControl } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMutation as useConvexMutation } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  profileVisibilitySchema,
  type ProfileVisibilityDto
} from '@artificer-toolkit/schema/api/account'
import * as styles from './settings.css'

export function ProfileVisibilitySetting({
  username,
  visibility
}: {
  username: string | null
  visibility: ProfileVisibilityDto
}) {
  const setVisibility = useConvexMutation(api.account.setProfileVisibility)
  const update = useMutation({
    mutationFn: setVisibility,
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not change your profile visibility. Try again.'
      })
    }
  })

  return (
    <div className={styles.settingRow}>
      <div className={styles.settingCopy}>
        <h2 className={styles.settingTitle}>Profile visibility</h2>
        <p className={styles.settingDescription}>
          Private shows your profile only to you. Public lets signed-in players see your username,
          avatar and bio. Your email stays private.
        </p>
        {visibility === 'PUBLIC' && username ? (
          <Link params={{ username }} to='/profiles/$username'>
            View public profile
          </Link>
        ) : null}
      </div>
      <SegmentedControl
        aria-label='Profile visibility'
        className={styles.appearanceControl}
        data={[
          { label: 'Private', value: 'PRIVATE' },
          { label: 'Public', value: 'PUBLIC' }
        ]}
        disabled={update.isPending}
        value={visibility}
        onChange={(value) => update.mutate({ visibility: profileVisibilitySchema.parse(value) })}
      />
    </div>
  )
}
