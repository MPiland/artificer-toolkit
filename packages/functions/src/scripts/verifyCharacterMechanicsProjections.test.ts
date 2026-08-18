import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mechanics = {
  characterId: 'character-1',
  characterStreamVersion: 3,
  ruleRevisionId: 'rule-revision-1',
  projectionChecksum: 'a'.repeat(64)
}

const mocks = vi.hoisted(() => ({
  loadSources: vi.fn(),
  requireCurrent: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createCharacterMechanicsProjectionRepository: () => ({ requireCurrent: mocks.requireCurrent })
}))

vi.mock('../services/character/characterCommittedSheetSources.js', () => ({
  loadCharacterCommittedSheetSources: mocks.loadSources
}))

const { verifyCharacterMechanicsProjections } = await import('./verifyCharacterMechanicsProjections.js')

function createDb(
  rows: readonly { id: string; rule_pack_revision_id: string | null; stream_version: number }[]
): DBLike {
  const builder = {
    select: () => builder,
    where: () => builder,
    execute: async () => rows
  }
  return { selectFrom: () => builder } as unknown as DBLike
}

describe('verifyCharacterMechanicsProjections', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireCurrent.mockResolvedValue(mechanics)
    mocks.loadSources.mockResolvedValue({})
  })

  it('checks each active Character against its stream, rule pin, exact sources, and checksum', async () => {
    await expect(
      verifyCharacterMechanicsProjections(
        createDb([{ id: mechanics.characterId, stream_version: 3, rule_pack_revision_id: mechanics.ruleRevisionId }])
      )
    ).resolves.toBe(1)

    expect(mocks.requireCurrent).toHaveBeenCalledWith({
      characterId: mechanics.characterId,
      expectedRuleRevisionId: mechanics.ruleRevisionId,
      expectedStreamVersion: mechanics.characterStreamVersion
    })
    expect(mocks.loadSources).toHaveBeenCalledWith({ db: expect.anything(), mechanics })
  })

  it('fails closed when an active Character has no pinned rule revision', async () => {
    await expect(
      verifyCharacterMechanicsProjections(
        createDb([{ id: mechanics.characterId, stream_version: 3, rule_pack_revision_id: null }])
      )
    ).rejects.toThrow('has no pinned rule revision')

    expect(mocks.requireCurrent).not.toHaveBeenCalled()
  })

  it('propagates a missing exact projection source', async () => {
    mocks.loadSources.mockRejectedValue(new Error('unavailable exact authored version'))

    await expect(
      verifyCharacterMechanicsProjections(
        createDb([{ id: mechanics.characterId, stream_version: 3, rule_pack_revision_id: mechanics.ruleRevisionId }])
      )
    ).rejects.toThrow('unavailable exact authored version')
  })
})
