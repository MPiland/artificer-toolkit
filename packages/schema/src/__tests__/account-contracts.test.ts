import { describe, expect, it } from 'vitest'
import {
  accountDeleteInputSchema,
  accountEmailConfirmationSearchSchema,
  accountProfileDtoSchema,
  accountProfileUpdateInputSchema
} from '../api/account.js'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  authEmailConfirmationSearchSchema,
  authInvitationCompletionInputSchema,
  authSignInInputSchema,
  authSignUpInputSchema,
  passwordInputSchema
} from '../api/auth.js'

describe('account contracts', () => {
  it('keeps verification failures bounded and strips unrelated search fields', () => {
    expect(authEmailConfirmationSearchSchema.parse({})).toEqual({})
    expect(
      authEmailConfirmationSearchSchema.parse({
        error: 'TOKEN_EXPIRED',
        redirect: '/home'
      })
    ).toEqual({ error: 'TOKEN_EXPIRED' })
    expect(
      accountEmailConfirmationSearchSchema.parse({
        emailChanged: '1',
        error: 'TOKEN_EXPIRED',
        redirect: '/home'
      })
    ).toEqual({ emailChanged: '1', error: 'TOKEN_EXPIRED' })
    expect(accountEmailConfirmationSearchSchema.safeParse({ emailChanged: 'true' }).success).toBe(
      false
    )
    for (const error of ['x'.repeat(129), { message: 'private' }, false]) {
      expect(authEmailConfirmationSearchSchema.parse({ error })).toEqual({
        error: 'INVALID_CALLBACK'
      })
      expect(accountEmailConfirmationSearchSchema.parse({ emailChanged: '1', error })).toEqual({
        emailChanged: '1',
        error: 'INVALID_CALLBACK'
      })
    }
  })
  it('normalizes blank profile values to null', () => {
    expect(accountProfileUpdateInputSchema.parse({ bio: '' })).toEqual({
      bio: null
    })
    expect(
      accountProfileUpdateInputSchema.parse({
        username: 'legacy_player',
        bio: ''
      })
    ).toEqual({
      username: 'legacy_player',
      bio: null
    })
    expect(accountProfileDtoSchema.parse({ username: 'player_one', bio: null })).toEqual({
      username: 'player_one',
      bio: null
    })
    expect(accountProfileDtoSchema.parse({ username: null, bio: null })).toEqual({
      username: null,
      bio: null
    })
  })

  it('requires usernames for account creation and invitation completion', () => {
    expect(
      authSignUpInputSchema.parse({
        email: 'player@example.com',
        password: 'password1234',
        username: 'player_one'
      })
    ).toEqual({
      email: 'player@example.com',
      password: 'password1234',
      username: 'player_one'
    })
    expect(
      authInvitationCompletionInputSchema.parse({
        password: 'password1234',
        username: 'player_one'
      })
    ).toEqual({ password: 'password1234', username: 'player_one' })
    expect(
      authInvitationCompletionInputSchema.safeParse({
        password: 'password1234'
      }).success
    ).toBe(false)
  })

  it('accepts either an email or username as a sign-in identifier', () => {
    expect(
      authSignInInputSchema.parse({
        identifier: '  player_one  ',
        password: 'password1234'
      })
    ).toEqual({ identifier: 'player_one', password: 'password1234' })
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
