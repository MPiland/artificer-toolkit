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
      'Admin'
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

  // Q22: the substring check refused these ordinary names.
  it.each([
    'Cassandra',
    'Classic',
    'Dickens',
    'Essex',
    'Glasshouse',
    'Assassin',
    'Scunthorpe',
    'Cummings',
    'Penistone',
    'Titan',
    'Compass',
    'Player1'
  ])('accepts the ordinary name %s', (username) => {
    expect(validateUsername(username)).toEqual({ username, message: null })
  })

  // Q22: short ambiguous terms are refused as a whole part, however the parts are separated.
  it.each([
    'ass_muncher',
    'AssMuncher',
    'Ass1Muncher',
    'a55_muncher',
    'xx_dick_xx',
    'DickHead',
    'Cum_Dump',
    'the_tit_bird',
    'ASSMuncher',
    'Asssss_Muncher',
    // A case change inside the term must not hide the `_` part from the whole-part check.
    'My_aSS',
    'Big_DiCk',
    'aSS_Muncher',
    'Big_Cums'
  ])('refuses the blocked part in %s', (username) => {
    expect(validateUsername(username)).toEqual({ username, message: USERNAME_NOT_ALLOWED_MESSAGE })
  })

  // Q22: unambiguous terms are refused anywhere, including inside one part and across `_`.
  it.each([
    'fuuuck_me',
    'Xfuckx',
    'n_i_g_g_e_r',
    'Asshole',
    'DumbAss',
    'Dickhead',
    'assman',
    'titty',
    'Tittie',
    'TittyLover',
    'Titty_Fan'
  ])(
    'refuses the unambiguous term in %s',
    (username) => {
      expect(validateUsername(username)).toEqual({
        username,
        message: USERNAME_NOT_ALLOWED_MESSAGE
      })
    }
  )

  it('leaves the unbroken compound to the server check', () => {
    expect(validateUsername('assmuncher')).toEqual({ username: 'assmuncher', message: null })
  })
})
