import { Button, Loader, TextInput, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import {
  type RequestForQueries,
  useConvexAuth,
  useMutation as useConvexMutation,
  useQueries
} from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { type SubmitEvent, useEffect, useMemo, useState } from 'react'
import { usernameInputSchema } from '@artificer-toolkit/schema/api/auth'
import {
  accountProfileDtoSchema,
  type AccountProfileDto
} from '@artificer-toolkit/schema/api/account'
import { MediaImageControl } from '#app/components/MediaImage'
import { getUsernameStatus } from '#app/auth/usernameStatus'
import {
  usernameFormatMessage,
  usernameNotAllowedMessage,
  usernameTakenMessage
} from '#app/auth/usernameMessages'
import { ProfileVisibilitySetting } from './ProfileVisibilitySetting'
import * as styles from './settings.css'

export function ProfileSettingsPage({ userId }: { userId: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth()
  // useQueries keys its subscription by request-map identity, including the skipped map.
  const queries = useMemo((): RequestForQueries => {
    if (!isAuthenticated) return {}
    return { profile: { query: api.account.profile, args: {} } }
  }, [isAuthenticated])
  const profile: unknown = useQueries(queries).profile

  if (isLoading || !isAuthenticated || profile === undefined) {
    return (
      <div className={styles.loadingState} aria-label='Loading profile'>
        <Loader size='sm' />
      </div>
    )
  }

  const parsedProfile = accountProfileDtoSchema.safeParse(profile)
  if (!parsedProfile.success) {
    return (
      <div className={styles.errorState} role='alert'>
        <h2>Profile unavailable</h2>
        <p>Reload the page to try again.</p>
      </div>
    )
  }

  return <ProfileForm key={userId} initialProfile={parsedProfile.data} />
}

function ProfileForm({ initialProfile }: { initialProfile: AccountProfileDto }) {
  const router = useRouter()
  const saveProfile = useConvexMutation(api.account.updateProfile)
  const [usernameDraft, setUsername] = useState<string>()
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [checkedUsername, setCheckedUsername] = useState<{
    name: string
    status: Awaited<ReturnType<typeof getUsernameStatus>>['status'] | 'unavailable'
  }>()
  const [bioDraft, setBio] = useState<string>()
  const username = usernameDraft ?? initialProfile.username ?? ''
  const bio = bioDraft ?? initialProfile.bio ?? ''
  const usernameChanged = initialProfile.username !== username.trim()
  const usernameNeedsAvailabilityCheck =
    initialProfile.username?.toLowerCase() !== username.trim().toLowerCase()
  const parsedUsernameInput = usernameInputSchema.safeParse(username)
  const usernameToCheck =
    usernameNeedsAvailabilityCheck && parsedUsernameInput.success ? parsedUsernameInput.data : null
  const usernameAvailability = !usernameNeedsAvailabilityCheck
    ? 'available'
    : !parsedUsernameInput.success
      ? 'not_allowed'
      : checkedUsername?.name === usernameToCheck
        ? checkedUsername.status
        : 'checking'
  const availabilityError =
    usernameAvailability === 'taken'
      ? usernameTakenMessage
      : usernameAvailability === 'unavailable'
        ? 'Could not check that username. Try again.'
        : usernameAvailability === 'not_allowed'
          ? usernameToCheck
            ? usernameNotAllowedMessage
            : usernameFormatMessage
          : null

  useEffect(() => {
    if (!usernameToCheck) return

    let active = true
    const timeout = window.setTimeout(() => {
      void getUsernameStatus(usernameToCheck)
        .then(({ status }) => {
          if (active) setCheckedUsername({ name: usernameToCheck, status })
        })
        .catch(() => {
          if (active) setCheckedUsername({ name: usernameToCheck, status: 'unavailable' })
        })
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [usernameToCheck])

  const updateProfile = useMutation({
    mutationFn: saveProfile,
    onSuccess: (profile, input) => {
      setUsername((current) => (current?.trim() === profile.username ? undefined : current))
      setBio((current) => (current === input.bio ? undefined : current))
      setUsernameError(null)
      notifications.show({ color: 'green', message: 'Profile saved.' })
      void router.invalidate()
    },
    onError: () => {
      notifications.show({
        color: 'red',
        message: 'Could not save your profile. Try again.'
      })
    }
  })

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()

    const parsedUsername = usernameInputSchema.safeParse(username)
    if (!parsedUsername.success) {
      setUsernameError(usernameFormatMessage)
      return
    }

    if (usernameNeedsAvailabilityCheck && usernameAvailability !== 'available') {
      setUsernameError(
        usernameAvailability === 'checking'
          ? 'Checking username availability.'
          : usernameAvailability === 'unavailable'
            ? 'Could not check that username. Try again.'
            : usernameAvailability === 'taken'
              ? usernameTakenMessage
              : usernameNotAllowedMessage
      )
      return
    }

    setUsernameError(null)
    updateProfile.mutate({ ...(usernameChanged ? { username: parsedUsername.data } : {}), bio })
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
      <ProfileVisibilitySetting
        username={initialProfile.username}
        visibility={initialProfile.visibility}
      />
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
            usernameAvailability === 'checking'
              ? 'Checking availability…'
              : 'Your username is used for sign-in and account attribution.'
          }
          error={usernameError ?? availabilityError}
          label='Username'
          maxLength={30}
          minLength={3}
          name='username'
          onChange={(event) => {
            setUsername(event.currentTarget.value)
            setUsernameError(null)
          }}
          required
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
          <Button
            disabled={usernameNeedsAvailabilityCheck && usernameAvailability !== 'available'}
            loading={updateProfile.isPending}
            type='submit'
          >
            Save profile
          </Button>
        </div>
      </form>
    </section>
  )
}
