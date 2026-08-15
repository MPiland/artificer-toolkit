import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const mocks = vi.hoisted(() => ({
  findCharacter: vi.fn(),
  findCharacterRow: vi.fn(),
  findUpdatedAt: vi.fn(),
  lockCharacter: vi.fn(),
  upsertCharacter: vi.fn(),
  loadContext: vi.fn(),
  reconcile: vi.fn(),
  resolve: vi.fn(),
  saveDraft: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCharacterRepository: () => ({
      findAuthoredById: mocks.findCharacter,
      findById: mocks.findCharacterRow,
      findUpdatedAtById: mocks.findUpdatedAt,
      findUpdatedAtByIdForUpdate: mocks.lockCharacter,
      upsertAuthored: mocks.upsertCharacter
    }),
    createCharacterBuilderDraftRepository: () => ({ save: mocks.saveDraft })
  }
})

vi.mock('./builderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./builderService.js')>()
  return {
    ...actual,
    loadCharacterBuilderContext: mocks.loadContext,
    resolveCharacterBuilder: mocks.resolve
  }
})
vi.mock('./builderReconciliation.js', () => ({
  reconcileCharacterBuilderCharacter: mocks.reconcile
}))

const { createEmptyCharacterAuthored } = await import('./builderService.js')
const { reconcileCharacterAfterCampaignContentRemoval } =
  await import('./campaignCharacterReconciliation.js')

describe('Campaign Character removal reconciliation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findUpdatedAt.mockResolvedValue('2026-08-06T12:00:00.000Z')
    mocks.findCharacterRow.mockResolvedValue({ rule_pack_revision_id: 'revision-1' })
    mocks.lockCharacter.mockResolvedValue('2026-08-06T11:59:00.000Z')
    mocks.upsertCharacter.mockResolvedValue(2)
    mocks.loadContext.mockResolvedValue({})
    mocks.saveDraft.mockResolvedValue({})
  })

  it('writes a player-owned draft while preserving the conflicting structural root', async () => {
    const character = createEmptyCharacterAuthored({
      id: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
      systemId: '00000000-0000-4000-8000-000000000003'
    })
    character.status = 'ACTIVE'
    character.label = 'Rook'
    character.intent.race.raceId = '00000000-0000-4000-8000-000000000004'
    mocks.findCharacter.mockResolvedValue(character)
    mocks.reconcile.mockImplementation(async (_db: DBLike, value: unknown) => value)
    mocks.resolve.mockResolvedValue({ readiness: { ready: false } })

    await expect(
      reconcileCharacterAfterCampaignContentRemoval({} as DBLike, character.id)
    ).resolves.toBe(true)

    const saved = mocks.saveDraft.mock.calls[0]?.[0]
    expect(mocks.upsertCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DRAFT' }),
      { incrementStreamVersion: true }
    )
    expect(saved.payload.character).toMatchObject({
      status: 'DRAFT',
      intent: { race: { raceId: character.intent.race.raceId } }
    })
    expect(saved.userId).toBe(character.userId)
  })
})
