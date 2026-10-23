import { describe, expect, it } from 'vitest'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { presentRetainedRoll, presentRoll } from './rollPresentation.js'
import { createRollRecord } from './rollRecord.js'

const record = createRollRecord({
  characterId: null,
  label: 'shit goblin',
  system: { id: DND5E_SYSTEM_ID, rulesetCode: 'SRD', rulesetVersion: '5.2' },
  resolved: {
    expression: '1d20',
    rollMode: 'NORMAL',
    source: { kind: 'MANUAL', label: 'shit secret' }
  },
  nextInt: () => 0
})

describe('roll presentation', () => {
  it('masks the free-text labels at STANDARD maturity and nothing else', () => {
    const masked = presentRoll(record, 'STANDARD')
    expect(masked.characterLabel).not.toContain('shit')
    expect(masked.source.label).not.toContain('shit')
    expect({ ...masked, characterLabel: '', source: record.source }).toEqual({
      ...record,
      characterLabel: ''
    })
  })

  it('leaves MATURE and unscoped rolls as written', () => {
    expect(presentRoll(record, 'MATURE')).toEqual(record)
    expect(presentRoll(record, null)).toEqual(record)
  })

  it('keeps the GM binding on a retained roll while masking it', () => {
    const gmCampaignRoll = {
      campaignId: crypto.randomUUID(),
      creature: null,
      revealedAt: null,
      noticedAt: null
    }
    expect(presentRetainedRoll({ ...record, gmCampaignRoll }, 'STANDARD')).toEqual({
      ...presentRoll(record, 'STANDARD'),
      gmCampaignRoll
    })
  })
})
