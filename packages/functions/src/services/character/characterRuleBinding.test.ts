import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike, RulePackRevisionRecord } from '@artificer-toolkit/db'

const mocks = vi.hoisted(() => ({
  findActiveByRuleset: vi.fn(),
  findRulesetForSystem: vi.fn(),
  getRevisionWithPack: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createRulePackRepository: () => ({
      findActiveByRuleset: mocks.findActiveByRuleset,
      findRulesetForSystem: mocks.findRulesetForSystem,
      getRevisionWithPack: mocks.getRevisionWithPack
    })
  }
})

const { resolveCharacterRuleBinding } = await import('./characterRuleBinding.js')

function revision(state: RulePackRevisionRecord['state'] = 'ACTIVE'): RulePackRevisionRecord {
  return {
    id: 'revision-1',
    rulePackId: 'pack-1',
    revision: 1,
    evaluatorKind: 'ZEN',
    evaluatorVersion: '0.54.0',
    modelContractVersion: 4,
    document: { models: { 'character-policy': {} } },
    checksum: 'checksum-1',
    createdBy: 'admin-1',
    activatedBy: 'admin-1',
    activatedAt: '2026-08-13T00:00:00.000Z',
    state,
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z'
  }
}

describe('Character rule revision binding', () => {
  beforeEach(() => {
    mocks.findActiveByRuleset.mockReset()
    mocks.findRulesetForSystem
      .mockReset()
      .mockResolvedValue({ systemId: 'system-1', code: 'dnd5e', version: '2014' })
    mocks.getRevisionWithPack.mockReset()
  })

  it('selects the current active revision for an unpinned Character evaluation', async () => {
    mocks.findActiveByRuleset.mockResolvedValue(revision())

    await expect(
      resolveCharacterRuleBinding({
        db: {} as DBLike,
        systemId: 'system-1',
        existingRevisionId: null
      })
    ).resolves.toMatchObject({ revisionId: 'revision-1', checksum: 'checksum-1' })

    expect(mocks.findActiveByRuleset).toHaveBeenCalledWith('dnd5e', '2014')
  })

  it('keeps a compatible retired pin instead of moving to the current active revision', async () => {
    mocks.getRevisionWithPack.mockResolvedValue({
      pack: { rulesetCode: 'dnd5e', version: '2014' },
      revision: revision('RETIRED')
    })

    await expect(
      resolveCharacterRuleBinding({
        db: {} as DBLike,
        systemId: 'system-1',
        existingRevisionId: 'revision-1'
      })
    ).resolves.toMatchObject({ revisionId: 'revision-1' })

    expect(mocks.findActiveByRuleset).not.toHaveBeenCalled()
  })

  it('accepts a matching expected revision', async () => {
    mocks.findActiveByRuleset.mockResolvedValue(revision())

    await expect(
      resolveCharacterRuleBinding({
        db: {} as DBLike,
        systemId: 'system-1',
        existingRevisionId: null,
        expectedRevisionId: 'revision-1'
      })
    ).resolves.toMatchObject({ revisionId: 'revision-1' })
  })

  it('rejects a mismatched expected revision before persistence', async () => {
    mocks.findActiveByRuleset.mockResolvedValue(revision())

    await expect(
      resolveCharacterRuleBinding({
        db: {} as DBLike,
        systemId: 'system-1',
        existingRevisionId: null,
        expectedRevisionId: 'revision-2'
      })
    ).rejects.toThrow('changed before the save')
  })

  it('rejects a mismatched expected revision for an existing retired pin', async () => {
    mocks.getRevisionWithPack.mockResolvedValue({
      pack: { rulesetCode: 'dnd5e', version: '2014' },
      revision: revision('RETIRED')
    })

    await expect(
      resolveCharacterRuleBinding({
        db: {} as DBLike,
        systemId: 'system-1',
        existingRevisionId: 'revision-1',
        expectedRevisionId: 'revision-2'
      })
    ).rejects.toThrow('changed before the save')
  })

  it.each([
    ['missing', null],
    ['draft', { pack: { rulesetCode: 'dnd5e', version: '2014' }, revision: revision('DRAFT') }]
  ])('rejects a %s existing pin', async (_label, pinned) => {
    mocks.getRevisionWithPack.mockResolvedValue(pinned)

    await expect(
      resolveCharacterRuleBinding({
        db: {} as DBLike,
        systemId: 'system-1',
        existingRevisionId: 'revision-1'
      })
    ).rejects.toMatchObject({ name: 'CharacterRuleBindingError' })
  })

  it('rejects an incompatible existing pin', async () => {
    mocks.getRevisionWithPack.mockResolvedValue({
      pack: { rulesetCode: 'other', version: '1' },
      revision: revision('RETIRED')
    })

    await expect(
      resolveCharacterRuleBinding({
        db: {} as DBLike,
        systemId: 'system-1',
        existingRevisionId: 'revision-1'
      })
    ).rejects.toThrow('incompatible')
  })

  it('rejects an active revision created for a different evaluator contract', async () => {
    mocks.findActiveByRuleset.mockResolvedValue({ ...revision(), evaluatorVersion: '0.53.0' })

    await expect(
      resolveCharacterRuleBinding({
        db: {} as DBLike,
        systemId: 'system-1',
        existingRevisionId: null
      })
    ).rejects.toThrow('unsupported evaluator contract')
  })

  it('rejects an active revision without the Character policy model', async () => {
    mocks.findActiveByRuleset.mockResolvedValue({ ...revision(), document: { models: {} } })

    await expect(
      resolveCharacterRuleBinding({
        db: {} as DBLike,
        systemId: 'system-1',
        existingRevisionId: null
      })
    ).rejects.toThrow('unsupported evaluator contract')
  })
})
