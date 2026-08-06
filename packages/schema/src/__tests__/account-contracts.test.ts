import { describe, expect, it } from 'vitest'
import {
  accountDeleteInputSchema,
  accountProfileDtoSchema,
  accountProfileUpdateInputSchema
} from '../api/account.js'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  authInvitationCompletionInputSchema,
  authSignUpInputSchema,
  passwordInputSchema
} from '../api/auth.js'

describe('account contracts', () => {
  it('normalizes blank profile values to null', () => {
    expect(
      accountProfileUpdateInputSchema.parse({ username: null, name: '  ', bio: '' })
    ).toEqual({
      username: null,
      name: null,
      bio: null
    })
    expect(
      accountProfileDtoSchema.parse({ username: null, name: null, bio: null })
    ).toEqual({ username: null, name: null, bio: null })
  })

  it('does not require usernames for account creation or invitation completion', () => {
    expect(
      authSignUpInputSchema.parse({
        email: 'player@example.com',
        password: 'password1234'
      })
    ).toEqual({ email: 'player@example.com', password: 'password1234' })
    expect(
      authInvitationCompletionInputSchema.parse({ password: 'password1234' })
    ).toEqual({ password: 'password1234' })
  })

  it('accepts only passwords between the shared 12 and 128 character bounds', () => {
    expect(passwordInputSchema.safeParse('p'.repeat(PASSWORD_MIN_LENGTH - 1)).success).toBe(false)
    expect(passwordInputSchema.safeParse('p'.repeat(PASSWORD_MIN_LENGTH)).success).toBe(true)
    expect(passwordInputSchema.safeParse('p'.repeat(PASSWORD_MAX_LENGTH)).success).toBe(true)
    expect(passwordInputSchema.safeParse('p'.repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false)
  })

  it('requires both email and current password to delete an account', () => {
    expect(
      accountDeleteInputSchema.safeParse({
        email: 'player@example.com',
        currentPassword: ''
      }).success
    ).toBe(false)
  })
})
