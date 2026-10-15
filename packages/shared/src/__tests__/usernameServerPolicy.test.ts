import { describe, expect, it } from 'vitest'

import { USERNAME_NOT_ALLOWED_MESSAGE, validateUsername } from '../domains/account/usernamePolicy.js'
import { validateUsernameOnServer } from '../domains/account/usernameServerPolicy.js'

describe('validateUsernameOnServer', () => {
  // Q22: an unbroken compound is refused when it splits into a blocked word plus dictionary words.
  it.each([
    'assmuncher',
    'AssMuncher',
    'xxAssmuncher',
    'a55muncher',
    'dickwrangler',
    'cumdumpster',
    'titmuncher'
  ])('refuses the compound %s', (username) => {
    expect(validateUsernameOnServer(username)).toEqual({
      username,
      message: USERNAME_NOT_ALLOWED_MESSAGE
    })
  })

  it.each([
    'cassandra',
    'Cassandra',
    'Classic',
    'Dickens',
    'Essex',
    'Glasshouse',
    'Assassin',
    'Scunthorpe',
    'Compass',
    'Hancock',
    'Massive',
    'Titanic',
    'Cumberland',
    'Passage',
    'Player_One'
  ])('accepts the ordinary name %s', (username) => {
    expect(validateUsernameOnServer(username)).toEqual({ username, message: null })
  })

  it('keeps every refusal of the client check', () => {
    for (const username of ['ab', 'admin', 'ass_muncher', 'a55_muncher', 'Ass1Muncher']) {
      expect(validateUsernameOnServer(username)).toEqual(validateUsername(username))
      expect(validateUsernameOnServer(username).message).toBe(USERNAME_NOT_ALLOWED_MESSAGE)
    }
  })
})
