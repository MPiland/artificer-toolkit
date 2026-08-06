import { Button, Loader, TextInput, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type SubmitEvent, useState } from 'react'
import { usernameInputSchema } from '@artificer-toolkit/schema/api/auth'
import type {
  AccountProfileDto,
  AccountProfileUpdateInput
} from '@artificer-toolkit/schema/api/account'
import { ApiError, api } from '#app/lib/api'
import { MediaImageControl } from '#app/components/MediaImage'
import { getAccountProfileQuery } from './accountQueries'
import * as styles from './settings.css'

export function ProfileSettingsPage({ userId }: { userId: string }) {
  const profileQuery = useQuery(getAccountProfileQuery(userId))

  if (profileQuery.isPending) {
    return (
      <div className={styles.loadingState} aria-label='Loading profile'>
        <Loader size='sm' />
      </div>
    )
  }

  if (profileQuery.isError) {
    return (
      <div className={styles.errorState} role='alert'>
        <h2>Profile unavailable</h2>
        <p>Reload the page to try again.</p>
      </div>
    )
  }

  if (!profileQuery.data) return null

  return <ProfileForm initialProfile={profileQuery.data} userId={userId} />
}

function ProfileForm({
  initialProfile,
  userId
}: {
  initialProfile: AccountProfileDto
  userId: string
}) {
  const queryClient = useQueryClient()
  const [username, setUsername] = useState(initialProfile.username ?? '')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [bio, setBio] = useState(initialProfile.bio ?? '')
  const needsUsername = initialProfile.username === null
  const updateProfile = useMutation({
    mutationFn: (input: AccountProfileUpdateInput) => api.account.updateProfile(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(getAccountProfileQuery(userId).queryKey, profile)
      setUsername(profile.username ?? '')
      setBio(profile.bio ?? '')
      setUsernameError(null)
      notifications.show({ color: 'green', message: 'Profile saved.' })
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.message.toLowerCase().includes('username'))
      ) {
        setUsernameError(error.message)
        return
      }
      notifications.show({
        color: 'red',
        message: 'Could not save your profile. Try again.'
      })
    }
  })

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (!needsUsername) {
      updateProfile.mutate({ bio })
      return
    }

    const parsedUsername = usernameInputSchema.safeParse(username)
    if (!parsedUsername.success) {
      setUsernameError(
        'Use 3–30 letters, numbers, and single underscores between words. Capitalization is preserved.'
      )
      return
    }

    setUsernameError(null)
    updateProfile.mutate({ username: parsedUsername.data, bio })
  }

  return (
    <section aria-labelledby='profile-settings-title'>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle} id='profile-settings-title'>
          Profile
        </h1>
        <p className={styles.pageDescription}>
          Manage the avatar and biography shown with your account.
        </p>
      </header>
      <form className={styles.form} method='post' onSubmit={handleSubmit}>
        <div className={styles.avatarSetting}>
          <div>
            <h2 className={styles.settingTitle}>Avatar</h2>
            <p className={styles.settingDescription}>Choose the image shown with your account.</p>
          </div>
          <MediaImageControl
            label='Change avatar'
            mode='square'
            profile='ACCOUNT_AVATAR'
            target={{ lookup: { type: 'ACCOUNT_AVATAR' }, attach: { type: 'ACCOUNT_AVATAR' } }}
            variant='avatar'
          />
        </div>
        <TextInput
          autoComplete='username'
          description={
            needsUsername
              ? 'Choose the username you will use for sign-in and account attribution.'
              : 'Your username is used for sign-in and account attribution.'
          }
          error={usernameError}
          label='Username'
          maxLength={30}
          minLength={3}
          name='username'
          onChange={
            needsUsername
              ? (event) => {
                  setUsername(event.currentTarget.value)
                  setUsernameError(null)
                }
              : undefined
          }
          readOnly={!needsUsername}
          required={needsUsername}
          value={username}
        />
        <Textarea
          autosize
          description={`${bio.length}/500 characters`}
          label='Bio'
          maxLength={500}
          minRows={5}
          name='bio'
          value={bio}
          onChange={(event) => setBio(event.currentTarget.value)}
        />
        <div className={styles.formActions}>
          <Button loading={updateProfile.isPending} type='submit'>
            Save profile
          </Button>
        </div>
      </form>
    </section>
  )
}
