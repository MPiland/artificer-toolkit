import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  owner: '00000000-0000-4000-8000-000000000002',
  system: '00000000-0000-4000-8000-000000000004',
  command: '00000000-0000-4000-8000-000000000006',
  revision: '00000000-0000-4000-8000-000000000007',
  event: '00000000-0000-4000-8000-000000000008',
  actor: '00000000-0000-4000-8000-000000000009'
}

const mocks = vi.hoisted(() => ({
  authority: vi.fn(),
  encounter: { find: vi.fn(), listEventsPage: vi.fn() }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return { ...actual, createEncounterRepository: () => mocks.encounter }
})

vi.mock('../campaign/campaignService.js', () => ({
  assertActiveCampaignMember: vi.fn(),
  resolveCampaignAuthority: mocks.authority
}))

import { getEncounterTimeline } from './encounterTimelineService.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authority.mockResolvedValue({
    campaign: { id: ids.campaign, status: 'ACTIVE' },
    membership: {
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: '2026-08-01T00:00:00.000Z'
    }
  })
  mocks.encounter.find.mockResolvedValue({ id: ids.command, campaignId: ids.campaign })
  mocks.encounter.listEventsPage.mockResolvedValue([])
})

describe('encounter timeline', () => {
  it('pages only TABLE-visible events for players', async () => {
    await expect(
      getEncounterTimeline({} as DBLike, ids.owner, {
        encounterId: ids.command,
        limit: 20
      })
    ).resolves.toEqual({ entries: [], nextCursor: null })
    expect(mocks.encounter.listEventsPage).toHaveBeenCalledWith(ids.command, undefined, 21, 'TABLE')
  })

  it('projects a bounded action summary without private rule facts or traces', async () => {
    mocks.encounter.listEventsPage.mockResolvedValue([
      {
        id: ids.event,
        encounterId: ids.command,
        campaignId: ids.campaign,
        version: 2,
        commandId: ids.command,
        commandType: 'RESOLVE_ACTION',
        commandFingerprint: 'fingerprint',
        commandPayload: { visibility: 'TABLE' },
        resultPayload: {
          projection: {
            id: ids.command,
            campaignId: ids.campaign,
            sessionId: ids.command,
            gameSystemId: ids.system,
            blueprintId: ids.command,
            blueprintVersion: 1,
            blueprintChecksum: 'a'.repeat(64),
            rulePackRevisionId: ids.revision,
            name: 'Encounter',
            status: 'ACTIVE',
            automationMode: 'ASSISTED',
            manualReminderMode: 'OFF',
            version: 2,
            round: 1,
            currentActorId: null,
            actors: [],
            reminders: [],
            createdAt: '2026-08-12T00:00:00.000Z',
            updatedAt: '2026-08-12T00:00:00.000Z'
          },
          roll: null,
          resolution: {
            rulePackRevisionId: ids.revision,
            checksum: 'a'.repeat(64),
            evaluatorKind: 'ZEN',
            evaluatorVersion: '0.54.0',
            modelContractVersion: 4,
            modelKey: 'attack',
            normalizedFacts: { secret: 'not projected' },
            trace: { secret: 'not projected' },
            rolls: [],
            proposedOutcomes: [
              { kind: 'DAMAGE', targetActorId: ids.actor, amount: 4, damageTypeId: null }
            ],
            appliedOutcomes: [
              {
                proposed: {
                  kind: 'DAMAGE',
                  targetActorId: ids.actor,
                  amount: 4,
                  damageTypeId: null
                },
                status: 'APPLIED',
                before: { hitPoints: 10 },
                after: { hitPoints: 6 },
                correlatedCommandId: null
              }
            ],
            override: null
          }
        },
        actorUserId: ids.owner,
        correlationId: null,
        createdAt: '2026-08-12T00:00:00.000Z'
      }
    ])

    const timeline = await getEncounterTimeline({} as DBLike, ids.owner, {
      encounterId: ids.command,
      limit: 20
    })

    expect(timeline.entries[0]).toMatchObject({
      resolution: {
        rolls: [],
        outcomes: [{ kind: 'DAMAGE', status: 'APPLIED' }],
        overridden: false
      }
    })
    expect(JSON.stringify(timeline)).not.toContain('not projected')
    expect(JSON.stringify(timeline)).not.toContain('hitPoints')
  })
})
