import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike, EncounterRecord } from '@artificer-toolkit/db'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  encounter: '00000000-0000-4000-8000-000000000002',
  revision: '00000000-0000-4000-8000-000000000003',
  session: '00000000-0000-4000-8000-000000000004',
  template: '00000000-0000-4000-8000-000000000005'
}

const mocks = vi.hoisted(() => ({
  evaluate: vi.fn(),
  resolveActive: vi.fn()
}))

vi.mock('../rules/ruleRevisionRuntime.js', () => ({
  evaluateRuleRevision: mocks.evaluate
}))
vi.mock('./encounterRuleIdentity.js', () => ({
  encounterSystemIds: () => [],
  resolveActiveRulePackForSystems: mocks.resolveActive
}))

const { evaluateEncounterActorRules } = await import('./encounterActorRuleEvaluation.js')

function encounter(status: EncounterRecord['status'], revisionId: string | null): EncounterRecord {
  return {
    id: ids.encounter,
    campaignId: ids.campaign,
    sessionId: ids.session,
    templateId: ids.template,
    templateVersion: 1,
    rulePackRevisionId: revisionId,
    name: 'Encounter',
    status,
    version: 1,
    round: 0,
    currentActorId: null,
    actors: [],
    reminders: [],
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z'
  }
}

describe('Encounter actor rule evaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.evaluate.mockResolvedValue({ result: { actors: [] } })
    mocks.resolveActive.mockResolvedValue({ revision: { id: ids.revision } })
  })

  it('previews an unpinned prepared Encounter with the current compatible revision', async () => {
    await expect(
      evaluateEncounterActorRules({
        db: {} as DBLike,
        encounter: encounter('PREPARED', null)
      })
    ).resolves.toEqual({ actors: [] })
    expect(mocks.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ revisionId: ids.revision })
    )
  })

  it('fails closed for an unpinned active Encounter', async () => {
    await expect(
      evaluateEncounterActorRules({
        db: {} as DBLike,
        encounter: encounter('ACTIVE', null)
      })
    ).rejects.toThrow('does not have a pinned rule revision')
    expect(mocks.evaluate).not.toHaveBeenCalled()
  })
})
