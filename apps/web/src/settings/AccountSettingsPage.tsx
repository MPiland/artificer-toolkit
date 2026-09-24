import { Alert, Button, PasswordInput, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { type SubmitEvent, useState } from 'react'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@artificer-toolkit/schema/api/auth'
import type { EntitlementProjectionDto } from '@artificer-toolkit/schema/api/campaignCore'
import { browserAuthClient } from '#app/auth/authClient'
import { accountClient } from './accountClient'
import { DeleteAccountModal } from './DeleteAccountModal'
import { EntitlementSummary } from './EntitlementSummary'
import * as styles from './settings.css'

export function AccountSettingsPage({
  email,
  emailChanged = false,
  emailConfirmationFailed = false,
  entitlements
}: {
  email: string
  emailChanged?: boolean
  emailConfirmationFailed?: boolean
  entitlements?: EntitlementProjectionDto
}) {
  const [deleteOpened, { close: closeDelete, open: openDelete }] = useDisclosure(false)
  const [activeEditor, setActiveEditor] = useState<'email' | 'password' | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  function closeEmailEditor() {
    setNewEmail('')
    setActiveEditor(null)
  }

  function closePasswordEditor() {
    setCurrentPassword('')
    setPassword('')
    setConfirmPassword('')
    setActiveEditor(null)
  }

  async function handleEmailSubmit(event: SubmitEvent) {
    event.preventDefault()
    setIsUpdatingEmail(true)
    const result = await accountClient.updateEmail({ email: newEmail })
    setIsUpdatingEmail(false)

    if (!result.ok) {
      notifications.show({
        color: 'red',
        message: result.message ?? 'Could not update your email. Try again.'
      })
      return
    }

    closeEmailEditor()
    notifications.show({
      color: 'green',
      message: 'Check both email addresses to confirm the change.'
    })
  }

  async function handlePasswordSubmit(event: SubmitEvent) {
    event.preventDefault()

    if (password !== confirmPassword) {
      notifications.show({ color: 'red', message: 'The new passwords do not match.' })
      return
    }

    setIsUpdatingPassword(true)
    const result = await accountClient.updatePassword({ email, currentPassword, password })
    setIsUpdatingPassword(false)

    if (!result.ok) {
      notifications.show({
        color: 'red',
        message: result.message ?? 'Could not update your password. Try again.'
      })
      return
    }

    closePasswordEditor()
    notifications.show({ color: 'green', message: 'Password updated.' })
  }

  async function handlePasswordReset() {
    setIsResettingPassword(true)
    const result = await browserAuthClient.requestPasswordReset({ email })
    setIsResettingPassword(false)

    notifications.show(
      result.ok
        ? {
            color: 'green',
            message: 'If an account is associated with this email, a password reset link was sent.'
          }
        : {
            color: 'red',
            message: result.message ?? 'Could not send a reset email. Try again.'
          }
    )
  }

  return (
    <section aria-labelledby='account-settings-title'>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle} id='account-settings-title'>
          Account
        </h1>
        <p className={styles.pageDescription}>
          Update the credentials used to sign in to the Forge.
        </p>
      </header>

      {emailConfirmationFailed ? (
        <Alert color='red' mt='lg' title='Email confirmation failed'>
          This confirmation link could not be used. Request another email change from your account
          settings.
        </Alert>
      ) : (
        emailChanged && (
          <Alert color='blue' mt='lg' title='Email confirmation received'>
            Your email change may still be waiting for confirmation from the other address.
          </Alert>
        )
      )}

      {entitlements ? <EntitlementSummary entitlements={entitlements} /> : null}

      <section className={styles.accountSection} aria-labelledby='email-settings-title'>
        <div className={styles.accountSectionSummary}>
          <div className={styles.settingCopy}>
            <h3 className={styles.settingTitle} id='email-settings-title'>
              Email
            </h3>
            <p className={styles.settingDescription}>{email}</p>
          </div>
          <Button
            aria-controls='change-email-form'
            aria-expanded={activeEditor === 'email'}
            type='button'
            variant='default'
            onClick={() => setActiveEditor(activeEditor === 'email' ? null : 'email')}
          >
            {activeEditor === 'email' ? 'Close email form' : 'Change email'}
          </Button>
        </div>
        {activeEditor === 'email' && (
          <form
            className={styles.accountForm}
            id='change-email-form'
            method='post'
            onSubmit={handleEmailSubmit}
          >
            <TextInput
              autoComplete='email'
              label='New email'
              name='email'
              type='email'
              value={newEmail}
              onChange={(event) => setNewEmail(event.currentTarget.value)}
              required
            />
            <div className={styles.formActions}>
              <Button loading={isUpdatingEmail} type='submit'>
                Update email
              </Button>
              <Button type='button' variant='default' onClick={closeEmailEditor}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className={styles.accountSection} aria-labelledby='password-settings-title'>
        <div className={styles.accountSectionSummary}>
          <div className={styles.settingCopy}>
            <h3 className={styles.settingTitle} id='password-settings-title'>
              Password
            </h3>
            <p className={styles.credentialValue} aria-label='Password hidden'>
              ********
            </p>
          </div>
          <div className={styles.accountActions}>
            <Button
              aria-controls='change-password-form'
              aria-expanded={activeEditor === 'password'}
              type='button'
              variant='default'
              onClick={() => setActiveEditor(activeEditor === 'password' ? null : 'password')}
            >
              {activeEditor === 'password' ? 'Close password form' : 'Change password'}
            </Button>
            <Button
              loading={isResettingPassword}
              type='button'
              variant='subtle'
              onClick={() => void handlePasswordReset()}
            >
              Send reset email
            </Button>
          </div>
        </div>
        {activeEditor === 'password' && (
          <form
            className={styles.accountForm}
            id='change-password-form'
            method='post'
            onSubmit={handlePasswordSubmit}
          >
            <PasswordInput
              autoComplete='current-password'
              label='Current password'
              name='currentPassword'
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.currentTarget.value)}
              required
            />
            <PasswordInput
              autoComplete='new-password'
              label='New password'
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              name='password'
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
            <PasswordInput
              autoComplete='new-password'
              label='Confirm new password'
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              name='confirmPassword'
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
              required
            />
            <div className={styles.formActions}>
              <Button loading={isUpdatingPassword} type='submit'>
                Update password
              </Button>
              <Button type='button' variant='default' onClick={closePasswordEditor}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className={styles.accountSection} aria-labelledby='delete-account-title'>
        <div className={styles.accountSectionSummary}>
          <div className={styles.settingCopy}>
            <h3 className={styles.settingTitle} id='delete-account-title'>
              Delete account
            </h3>
            <p className={styles.settingDescription}>
              Permanently delete this account and all data you own.
            </p>
          </div>
          <Button color='red' type='button' variant='outline' onClick={openDelete}>
            Delete account
          </Button>
        </div>
      </section>

      <DeleteAccountModal email={email} opened={deleteOpened} onClose={closeDelete} />
    </section>
  )
}
