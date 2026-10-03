import { describe, expect, it } from 'vitest'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { settleDepartedCharacters } from './characterDeparture'

describe('settleDepartedCharacters', () => {
  it('skips a deleted Character, whose effects account deletion already ended', async () => {
    const { t, campaign } = await setupCharacterRun()
    await expect(
      t.run(async (ctx) => {
        await settleDepartedCharacters(ctx, campaign.id, [crypto.randomUUID()])
      })
    ).resolves.toBeNull()
  })
})
