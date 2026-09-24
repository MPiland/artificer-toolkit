import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  LIVE_SESSION_CONTROL_PATH,
  LIVE_SESSION_CONTROL_SECRET_HEADER,
  type LiveSessionControlInput
} from '@artificer-toolkit/schema/api/liveSessions'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const workerUrl = 'https://live.example.invalid/base'
const secret = 'test-live-session-worker-secret-long-enough'
const send = makeFunctionReference<'action', LiveSessionControlInput, null>(
  'liveSessions/control:send'
)
const evictUser = makeFunctionReference<
  'action',
  { campaignId: string; userId: string; membershipEpoch: string },
  null
>('liveSessions/control:evictUser')
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)

beforeEach(() => {
  vi.stubEnv('LIVE_SESSION_WORKER_URL', workerUrl)
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function fetchOk() {
  const request = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) => new Response(null, { status: 204 })
  )
  vi.stubGlobal('fetch', request)
  return request
}

function campaignInput(): CreateCampaignInput {
  return {
    name: 'Live room control',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  }
}

describe('native live-room control client', () => {
  it('posts the exact private endpoint, header and strict body', async () => {
    const base = await readyCharacterFixture()
    const request = fetchOk()
    const input: LiveSessionControlInput = {
      campaignId: crypto.randomUUID(),
      operation: { type: 'CLOSE_ROOM' }
    }

    await expect(base.t.action(send, input)).resolves.toBeNull()
    expect(request).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledWith(
      new URL(LIVE_SESSION_CONTROL_PATH, workerUrl),
      expect.objectContaining({
        body: JSON.stringify(input),
        headers: {
          'Content-Type': 'application/json',
          [LIVE_SESSION_CONTROL_SECRET_HEADER]: secret
        },
        method: 'POST'
      })
    )
  })

  it('fails clearly for missing configuration and Worker rejection', async () => {
    const base = await readyCharacterFixture()
    const input: LiveSessionControlInput = {
      campaignId: crypto.randomUUID(),
      operation: { type: 'CLOSE_ROOM' }
    }
    vi.stubEnv('LIVE_SESSION_WORKER_URL', '')
    await expect(base.t.action(send, input)).rejects.toThrow('LIVE_SESSION_WORKER_URL')

    vi.stubEnv('LIVE_SESSION_WORKER_URL', workerUrl)
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', 'short')
    await expect(base.t.action(send, input)).rejects.toThrow('at least 32 bytes')

    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 }))
    )
    await expect(base.t.action(send, input)).rejects.toThrow('status 503')
  })

  it('evicts one membership epoch from the Campaign room without any Session', async () => {
    const base = await readyCharacterFixture()
    const campaign = await base.owner.caller.mutation(createCampaign, campaignInput())
    const request = fetchOk()
    const membershipEpoch = campaign.createdAt

    await base.t.action(evictUser, {
      campaignId: campaign.id,
      userId: base.other.userId,
      membershipEpoch
    })

    expect(
      request.mock.calls.map(([url, init]) => ({
        url: String(url),
        body: JSON.parse(String(init?.body))
      }))
    ).toEqual([
      {
        url: new URL(LIVE_SESSION_CONTROL_PATH, workerUrl).toString(),
        body: {
          campaignId: campaign.id,
          operation: {
            type: 'EVICT_USER',
            userId: base.other.userId,
            membershipEpoch
          }
        }
      }
    ])
  })
})
