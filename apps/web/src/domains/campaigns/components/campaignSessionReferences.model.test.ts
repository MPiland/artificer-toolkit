import { describe, expect, it } from 'vitest'
import { campaignSessionReferenceHref } from './campaignSessionReferences.model'

const campaign = { publicId: 'campaign-id', name: 'Forge Night' }

describe('campaignSessionReferenceHref', () => {
  it('opens Campaign notes for note pins', () => {
    expect(
      campaignSessionReferenceHref(campaign, {
        id: crypto.randomUUID(),
        campaignId: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        target: { kind: 'CAMPAIGN_NOTE', noteSectionId: crypto.randomUUID() },
        label: 'The Dockmaster',
        createdAt: new Date().toISOString()
      })
    ).toBe('/campaigns/campaign-id/forge-night?tab=notes')
  })

  it('opens authored detail routes for authored pins', () => {
    expect(
      campaignSessionReferenceHref(campaign, {
        id: crypto.randomUUID(),
        campaignId: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        target: {
          kind: 'AUTHORED_ROUTE',
          routeSubjectKind: 'SPELL',
          publicId: 'spell-id'
        },
        label: 'Arcane Lock',
        createdAt: new Date().toISOString()
      })
    ).toBe('/spells/spell-id/arcane-lock')
  })
})
