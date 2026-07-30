import { expect, it, vi } from 'vitest'
import { suggestUsername } from './usernameSuggestion'

it('normalizes an email and retries an unavailable username with a four-digit suffix', async () => {
  const getStatus = vi
    .fn()
    .mockResolvedValueOnce({ status: 'taken' })
    .mockResolvedValueOnce({ status: 'available' })

  await expect(
    suggestUsername('Mörgân.Emberfall@example.com', getStatus, () => 0.0042)
  ).resolves.toBe('morgan_emberfall_0042')
  expect(getStatus).toHaveBeenNthCalledWith(1, 'morgan_emberfall')
  expect(getStatus).toHaveBeenNthCalledWith(2, 'morgan_emberfall_0042')
})
