import { describe, expect, it } from 'vitest'
import { validateUsername } from '@artificer-toolkit/shared/account/username'
import { validateUsernameOnServer } from '@artificer-toolkit/shared/account/usernameServer'
import { generateProfileUsername, generateValidUsername } from '../tests/fixtures/generatedUsername'

describe('generated fixture usernames', () => {
  it('draws again until the real username policy accepts the name', () => {
    // The first suffix breaks the username format, so a redraw happens whatever the word list says.
    const suffixes = [
      '!!!!!!!!!!!!',
      'a55b00000000',
      '0000a55b0000',
      'c0ffee123456',
      'ffffffffffff'
    ]
    const expected = suffixes.find(
      (suffix) => validateUsernameOnServer(`Journey_${suffix}`).message === null
    )
    let drawn = 0

    const generated = generateValidUsername('Journey_', () => suffixes[drawn++] as string)

    expect(expected).toBeDefined()
    expect(validateUsernameOnServer(`Journey_${suffixes[0]}`).message).not.toBeNull()
    expect(generated).toEqual({ username: `Journey_${expected}`, suffix: expected })
    expect(drawn).toBe(suffixes.indexOf(expected as string) + 1)
    expect(drawn).toBeGreaterThan(1)
    expect(validateUsernameOnServer(generated.username).message).toBeNull()
  })

  // Sign-up enforces the server policy, which also refuses blocked-word compounds read through digit
  // look-alikes; a name only the client check passed refused both concurrent redeemers (run 41761359435).
  it('draws again when only the server policy refuses the name', () => {
    const suffixes = ['550717e705e5', 'c0ffee123456']
    let drawn = 0

    const generated = generateValidUsername('Draft_', () => suffixes[drawn++] as string)

    expect(validateUsername(`Draft_${suffixes[0]}`).message).toBeNull()
    expect(validateUsernameOnServer(`Draft_${suffixes[0]}`).message).not.toBeNull()
    expect(generated).toEqual({ username: `Draft_${suffixes[1]}`, suffix: suffixes[1] })
  })

  // Profile proof run 42685527484: a suffix allowed after `Draft_` is refused after `Reader_`
  // (the joined form reads as a blocked term), so the profile name is drawn, not derived.
  it('draws the profile name on its own when the author suffix only passes after another prefix', () => {
    const authorOnlySuffix = '1ea55ca7c007'
    const suffixes = [authorOnlySuffix, 'c0ffee123456']
    let drawn = 0

    const username = generateProfileUsername(() => suffixes[drawn++] as string)

    expect(validateUsernameOnServer(`Draft_${authorOnlySuffix}`).message).toBeNull()
    expect(validateUsernameOnServer(`Reader_${authorOnlySuffix}`).message).not.toBeNull()
    expect(username).toBe(`Reader_${suffixes[1]}`)
    expect(validateUsernameOnServer(username).message).toBeNull()
  })

  it('never returns a random name the real policy rejects', () => {
    for (let draw = 0; draw < 500; draw++) {
      expect(
        validateUsernameOnServer(generateValidUsername('Journey_').username).message
      ).toBeNull()
    }
  })

  it('fails loudly when the prefix can never form an allowed name', () => {
    expect(() => generateValidUsername('Not allowed!')).toThrow('allowed username')
  })
})
