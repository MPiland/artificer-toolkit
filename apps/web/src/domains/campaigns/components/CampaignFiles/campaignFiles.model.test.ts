import { describe, expect, it } from 'vitest'
import { validateCampaignFile } from './campaignFiles.model'

describe('validateCampaignFile', () => {
  it('accepts supported small Campaign files', () => {
    expect(
      validateCampaignFile(new File(['notes'], 'notes.txt', { type: 'text/plain' }), false)
    ).toBeNull()
  })

  it('rejects text handout maps and oversized files', () => {
    expect(validateCampaignFile(new File(['notes'], 'map.txt', { type: 'text/plain' }), true)).toBe(
      'Handout maps must be images.'
    )
    expect(
      validateCampaignFile(
        new File([new Uint8Array(6 * 1024 * 1024 + 1)], 'large.png', {
          type: 'image/png'
        }),
        false
      )
    ).toBe('Files must be 6 MB or smaller.')
  })
})
