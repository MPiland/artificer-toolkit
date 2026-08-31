import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  character: '00000000-0000-4000-8000-000000000002',
  user: '00000000-0000-4000-8000-000000000003'
}
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  assignment: vi.fn(),
  assignmentLookup: vi.fn(),
  guard: vi.fn(),
  liveAuthority: vi.fn(),
  context: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => ({
  createCampaignRepository: () => ({ findCampaignByCharacter: mocks.assignmentLookup }),
  createCampaignContentShareRepository: () => ({
    lockCampaignMemberForContentRead: mocks.access
  }),
  createCampaignCharacterMechanicsProjectionRepository: () => ({
    lockAssignment: mocks.assignment
  })
}))
vi.mock('./characterAssignmentAuthority.js', () => ({
  lockCharacterAssignmentAuthority: mocks.guard
}))
vi.mock('../campaign/liveSessionCommandAuthority.js', () => ({
  assertCharacterLiveSessionCommandAuthority: mocks.liveAuthority
}))
vi.mock('./campaignCharacterSheet.js', () => ({
  resolveCharacterSheetCampaignContext: mocks.context
}))

import {
  lockAssignedCharacterSheetCampaignCommandAccess,
  withLockedCharacterRuleExecutionCommandContext
} from './characterRuleExecutionCommandContext.js'

function dbWithCharacter(owner = ids.user) {
  let reads = 0
  const builder = {
    select: () => builder,
    where: () => builder,
    forUpdate: () => builder,
    executeTakeFirst: async () =>
      reads++ === 0
        ? { id: ids.character, user_id: owner }
        : {
            id: ids.character,
            user_id: owner,
            status: 'ACTIVE',
            rule_pack_revision_id: ids.campaign,
            stream_version: 4
          }
  }
  return { selectFrom: () => builder } as unknown as DBLike
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.access.mockResolvedValue({ campaignExists: true, memberActive: true })
  mocks.assignment.mockResolvedValue(undefined)
  mocks.liveAuthority.mockResolvedValue(undefined)
})

describe('Character rule-execution command context', () => {
  it('preserves the legacy Campaign-content access error exactly', async () => {
    mocks.access.mockResolvedValue({ campaignExists: true, memberActive: false })
    await expect(
      lockAssignedCharacterSheetCampaignCommandAccess({} as DBLike, {
        campaignId: ids.campaign,
        characterId: ids.character,
        userId: ids.user
      })
    ).rejects.toMatchObject({
      name: 'CampaignContentShareUnavailableError',
      message: `Campaign access is unavailable for Character "${ids.character}".`
    })
  })

  it('denies archived current Campaign authority before the Character root callback', async () => {
    mocks.assignmentLookup.mockResolvedValue({ campaignId: ids.campaign })
    mocks.context.mockResolvedValue({ campaignId: ids.campaign, campaignStatus: 'ARCHIVED' })
    const callback = vi.fn()
    await expect(
      withLockedCharacterRuleExecutionCommandContext(
        dbWithCharacter(),
        { actorUserId: ids.user, characterId: ids.character },
        callback
      )
    ).rejects.toThrow('Archived Campaigns are read-only.')
    expect(callback).not.toHaveBeenCalled()
  })

  it('uses the guard before assignment lookup and admits current assigned authority', async () => {
    mocks.assignmentLookup.mockResolvedValue({ campaignId: ids.campaign })
    mocks.context.mockResolvedValue({ campaignId: ids.campaign, campaignStatus: 'ACTIVE' })
    await expect(
      withLockedCharacterRuleExecutionCommandContext(
        dbWithCharacter(),
        { actorUserId: ids.user, characterId: ids.character },
        async (context) => context.currentVersion
      )
    ).resolves.toBe(4)
    expect(mocks.guard.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.assignmentLookup.mock.invocationCallOrder[0] ?? 0
    )
  })
})
