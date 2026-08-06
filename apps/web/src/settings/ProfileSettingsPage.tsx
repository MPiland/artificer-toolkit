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
  const [name, setName] = useState(initialProfile.name ?? '')
  const [bio, setBio] = useState(initialProfile.bio ?? '')
  const updateProfile = useMutation({
    mutationFn: (input: AccountProfileUpdateInput) => api.account.updateProfile(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(getAccountProfileQuery(userId).queryKey, profile)
      setUsername(profile.username ?? '')
      setName(profile.name ?? '')
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
    setUsernameError(null)

    const parsedUsername = username.trim() ? usernameInputSchema.safeParse(username) : null
    if (parsedUsername && !parsedUsername.success) {
      setUsernameError(
        'Use 3–30 letters, numbers, and single underscores between words. Capitalization is preserved.'
      )
      return
    }

    const normalizedUsername = parsedUsername?.success ? parsedUsername.data : null
    setUsername(normalizedUsername ?? '')
    updateProfile.mutate({
      username: normalizedUsername,
      name,
      bio
    })
  }

  return (
    <section aria-labelledby='profile-settings-title'>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle} id='profile-settings-title'>
          Profile
        </h1>
        <p className={styles.pageDescription}>
          Manage the optional username, name, and short biography shown with your account.
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
          autoComplete='nickname'
          description='Optional. Use 3–30 letters, numbers, and single underscores.'
          error={usernameError}
          label='Username'
          maxLength={30}
          name='username'
          value={username}
          onChange={(event) => {
            setUsername(event.currentTarget.value)
            setUsernameError(null)
          }}
        />
        <TextInput
          autoComplete='name'
          label='Name'
          description='Optional'
          maxLength={100}
          name='name'
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
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
