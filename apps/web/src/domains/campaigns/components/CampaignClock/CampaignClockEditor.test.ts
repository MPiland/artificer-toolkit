import { describe, expect, it } from 'vitest'
import { hasCorrectionReason } from './CampaignClockEditor'

describe('Campaign clock corrections', () => {
  it('requires an explicit reason for rewind and reset', () => {
    expect(hasCorrectionReason('   ')).toBe(false)
    expect(hasCorrectionReason('Corrected a mistaken advance')).toBe(true)
  })
})
