import { describe, expect, it } from 'vitest'
import {
  accountUsernameStatusDtoSchema,
  accountUsernameStatusInputSchema,
  accountDeleteInputSchema,
  accountProfileUpdateInputSchema
} from '../api/account.js'
import { authSignUpInputSchema } from '../api/auth.js'

describe('account contracts', () => {
  it('normalizes blank profile values to null', () => {
    expect(
      accountProfileUpdateInputSchema.parse({ username: ' Player_One ', name: '  ', bio: '' })
    ).toEqual({
      username: 'Player_One',
      name: null,
      bio: null
    })
  })

  it('requires and trims usernames for sign-up and profile updates', () => {
    expect(
      authSignUpInputSchema.parse({
        email: 'player@example.com',
        password: 'password123',
        username: ' Player_One '
      }).username
    ).toBe('Player_One')
    expect(accountProfileUpdateInputSchema.safeParse({ name: null, bio: null }).success).toBe(false)
  })

  it('parses username availability contracts', () => {
    expect(accountUsernameStatusInputSchema.parse({ username: ' Player_One ' })).toEqual({
      username: ' Player_One '
    })
    for (const status of ['available', 'taken', 'not_allowed'] as const) {
      expect(accountUsernameStatusDtoSchema.parse({ status })).toEqual({ status })
    }
    expect(accountUsernameStatusDtoSchema.safeParse({ status: 'unknown' }).success).toBe(false)
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
