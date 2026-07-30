import { describe, expect, it } from 'vitest'

import {
  USERNAME_NOT_ALLOWED_MESSAGE,
  validateUsername
} from '../domains/account/usernamePolicy.js'

describe('validateUsername', () => {
  it('trims an allowed username without changing its display casing', () => {
    expect(validateUsername('  Player_One  ')).toEqual({
      username: 'Player_One',
      message: null
    })
  })

  it('rejects invalid, reserved, and profane usernames with one message', () => {
    for (const username of [
      'ab',
      'player__one',
      '_player',
      'admin',
      'moderator',
      'support',
      'system',
      'root',
      'artificer',
      'artificer_toolkit',
      'Admin',
      'assassin'
    ]) {
      expect(validateUsername(username)).toEqual({
        username,
        message: USERNAME_NOT_ALLOWED_MESSAGE
      })
    }
  })

  it('rejects profanity after removing underscores and normalizing digit substitutions', () => {
    expect(validateUsername('B4_Stard_Handle')).toEqual({
      username: 'B4_Stard_Handle',
      message: USERNAME_NOT_ALLOWED_MESSAGE
    })
  })
})
