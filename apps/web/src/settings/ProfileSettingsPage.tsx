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
import { accountProfileQueryKey, getAccountProfileQuery } from './accountQueries'
import * as styles from './settings.css'

export function ProfileSettingsPage() {
  const profileQuery = useQuery(getAccountProfileQuery())

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

  return <ProfileForm initialProfile={profileQuery.data} />
}

function ProfileForm({ initialProfile }: { initialProfile: AccountProfileDto }) {
  const queryClient = useQueryClient()
  const [username, setUsername] = useState(initialProfile.username)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [name, setName] = useState(initialProfile.name ?? '')
  const [bio, setBio] = useState(initialProfile.bio ?? '')
  const updateProfile = useMutation({
    mutationFn: (input: AccountProfileUpdateInput) => api.account.updateProfile(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountProfileQueryKey, profile)
      setUsername(profile.username)
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

    const parsedUsername = usernameInputSchema.safeParse(username)
    if (!parsedUsername.success) {
      setUsernameError(
        'Use 3–30 letters, numbers, and single underscores between words. Capitalization is preserved.'
      )
      return
    }

    setUsername(parsedUsername.data)
    updateProfile.mutate({
      username: parsedUsername.data,
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
          Manage the handle, name, and short biography shown with your account.
        </p>
      </header>
      <form className={styles.form} method='post' onSubmit={handleSubmit}>
        <TextInput
          autoComplete='nickname'
          description='3–30 letters, numbers, and single underscores. Capitalization is preserved.'
          error={usernameError}
          label='Username'
          maxLength={30}
          name='username'
          required
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
