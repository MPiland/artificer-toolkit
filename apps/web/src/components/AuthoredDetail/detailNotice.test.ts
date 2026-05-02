import { vi } from 'vitest'
import { buildAuthoredDetailNotice } from './detailNotice'

describe('buildAuthoredDetailNotice', () => {
  it('keeps the draft switcher visible while viewing active content with a draft', () => {
    const notice = buildAuthoredDetailNotice({
      canViewActive: true,
      domainLabel: 'Spell',
      hasInvalidDraft: false,
      isViewingActive: true,
      mode: 'active',
      onDiscard: vi.fn(),
      onViewActive: vi.fn(),
      onViewDraft: vi.fn()
    })

    expect(notice?.title).toBe('Draft preview')
    expect(notice?.action?.label).toBe('View Draft')
    expect(notice?.body).toContain('active spell')
  })
})
