import { describe, expect, it } from 'vitest'
import { validateUsername } from '@artificer-toolkit/shared/account/username'
import { generateValidUsername } from '../tests/fixtures/generatedUsername'

describe('generated fixture usernames', () => {
  it('draws again until the real username policy accepts the name', () => {
    // The first suffix breaks the username format, so a redraw happens whatever the word list says.
    const suffixes = ['!!!!!!!!!!!!', 'a55b00000000', '0000a55b0000', 'c0ffee123456', 'ffffffffffff']
    const expected = suffixes.find((suffix) => validateUsername(`Journey_${suffix}`).message === null)
    let drawn = 0

    const generated = generateValidUsername('Journey_', () => suffixes[drawn++] as string)

    expect(expected).toBeDefined()
    expect(validateUsername(`Journey_${suffixes[0]}`).message).not.toBeNull()
    expect(generated).toEqual({ username: `Journey_${expected}`, suffix: expected })
    expect(drawn).toBe(suffixes.indexOf(expected as string) + 1)
    expect(drawn).toBeGreaterThan(1)
    expect(validateUsername(generated.username).message).toBeNull()
  })

  it('never returns a random name the real policy rejects', () => {
    for (let draw = 0; draw < 500; draw++) {
      expect(validateUsername(generateValidUsername('Journey_').username).message).toBeNull()
    }
  })

  it('fails loudly when the prefix can never form an allowed name', () => {
    expect(() => generateValidUsername('Not allowed!')).toThrow('allowed username')
  })
})
