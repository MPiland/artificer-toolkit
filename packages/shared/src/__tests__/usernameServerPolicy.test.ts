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

  // A blocked word split across `_` or case parts is still a compound of the joined name.
  it.each(['a_ss_muncher', 'aSSmuncher', 'My_aSS', 'Big_DiCk', 'aSS_Muncher'])(
    'refuses the joined compound %s',
    (username) => {
      expect(validateUsernameOnServer(username)).toEqual({
        username,
        message: USERNAME_NOT_ALLOWED_MESSAGE
      })
    }
  )

  // Short dictionary words count as dictionary words. `asslicker` also reads as `as` + `slicker`,
  // which is no shorter than `ass` + `licker`, so the blocked reading is kept.
  it.each(['bigass', 'bigdick', 'mydick', 'cumbag', 'hotass', 'asslicker'])(
    'refuses the short-word compound %s',
    (username) => {
      expect(validateUsernameOnServer(username)).toEqual({
        username,
        message: USERNAME_NOT_ALLOWED_MESSAGE
      })
    }
  )

  // Repeated-letter padding is collapsed before the compound check.
  it.each(['assmuncherrr', 'diickmuncher', 'cuummuncher', 'aassmuncher'])(
    'refuses the padded compound %s',
    (username) => {
      expect(validateUsernameOnServer(username)).toEqual({
        username,
        message: USERNAME_NOT_ALLOWED_MESSAGE
      })
    }
  )

  // Every whole-part term of the matcher, not only ass, dick, cum and tit.
  it.each(['cocklover', 'sexmachine', 'prickface'])(
    'refuses the compound %s of another whole-part term',
    (username) => {
      expect(validateUsernameOnServer(username)).toEqual({
        username,
        message: USERNAME_NOT_ALLOWED_MESSAGE
      })
    }
  )

  // Terms the matcher anchors on one side only are still refused inside an unbroken part.
  it.each(['bigcuntface', 'bigtwat', 'bigshitbag', 'bigshithead', 'mywank', 'hugeturd'])(
    'refuses the one-sided term in %s',
    (username) => {
      expect(validateUsernameOnServer(username)).toEqual({
        username,
        message: USERNAME_NOT_ALLOWED_MESSAGE
      })
    }
  )

  // A plural of a blocked term is blocked too.
  it.each(['bigdicks', 'bigcocks', 'mytits', 'Bigwhores'])(
    'refuses the plural compound %s',
    (username) => {
      expect(validateUsernameOnServer(username)).toEqual({
        username,
        message: USERNAME_NOT_ALLOWED_MESSAGE
      })
    }
  )

  // A name that also reads as ordinary words in fewer pieces is not a compound of a blocked term.
  it.each([
    'titanslayer',
    'titanqueen',
    'basstitan',
    'Titanfall_Fan',
    'compassrose',
    'Bluetit',
    'Cuminseed',
    'Titus',
    'TitusLee',
    'matthewtitus',
    'Dickerson',
    'Pettit',
    'Pettitt',
    'Cockburn'
  ])('accepts the name %s that reads as words', (username) => {
    expect(validateUsernameOnServer(username)).toEqual({ username, message: null })
  })

  it.each([
    'cassandra',
    'Cassandra',
    'Shuttlecock',
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
    'Player_One',
    'Dickson',
    'Cockpit',
    'Sextant',
    'Dickinson',
    'Hitchcock',
    'Middlesex',
    // Parts that are all words are not re-read as one compound.
    'Assassin_Creed',
    'Titan_Fall',
    'Compass_Rose',
    'TitanFall',
    // A padded name never reads as a term with a longer run than its own.
    'asmuncher'
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
