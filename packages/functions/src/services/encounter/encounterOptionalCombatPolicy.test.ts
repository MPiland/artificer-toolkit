import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  system: '00000000-0000-4000-8000-000000000002',
  source: '00000000-0000-4000-8000-000000000003',
  flanking: '00000000-0000-4000-8000-000000000004',
  facing: '00000000-0000-4000-8000-000000000005'
}

const mocks = vi.hoisted(() => ({
  requireCurrent: vi.fn(),
  listUnavailableSources: vi.fn(),
  requirePolicyModule: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createReusableDefinitionRepository: () => ({ requireCurrent: mocks.requireCurrent }),
    createCampaignRepository: () => ({
      listContentSourceIdsNotEnabledForCampaign: mocks.listUnavailableSources
    })
  }
})

vi.mock('../rules/platformRulesRuntime.js', () => ({
  requireInstalledGameSystemPolicyModule: mocks.requirePolicyModule
}))

const { resolveEncounterOptionalCombatSnapshot } =
  await import('./encounterOptionalCombatPolicy.js')
const { OptionalCombatSourceError, resolveCurrentOptionalCombatSources } =
  await import('../rules/optionalCombatSourceAccess.js')

function document(id: string, kind: 'FLANKING' | 'FACING', group: string | null = null) {
  return {
    schemaVersion: 1 as const,
    id,
    gameSystemId: ids.system,
    kind,
    module: { policyModuleKey: 'scene.grid.square.alternating-diagonals', contractVersion: 1 },
    parameters:
      kind === 'FLANKING'
        ? { kind, participantCapabilityDefinitionId: '00000000-0000-4000-8000-000000000006' }
        : { kind },
    mutuallyExclusiveGroup: group
  }
}

function current(id: string, kind: 'FLANKING' | 'FACING', group: string | null = null) {
  const value = document(id, kind, group)
  return {
    id,
    gameSystemId: ids.system,
    contentSourceId: ids.source,
    definitionFamilyKey: 'dnd5e-optional-combat',
    label: kind,
    description: null,
    document: value,
    checksum: checksumRuleDocument(value),
    contractVersion: 1,
    version: 2,
    publishedAt: '2026-08-29T00:00:00.000Z',
    publishedBy: ids.source
  }
}

describe('Encounter optional combat snapshot', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.listUnavailableSources.mockResolvedValue([])
    mocks.requirePolicyModule.mockReturnValue(undefined)
    mocks.requireCurrent.mockImplementation(async (id: string) =>
      id === ids.flanking ? current(id, 'FLANKING') : current(id, 'FACING')
    )
  })

  it('freezes exact current definitions in a checksum-protected Encounter snapshot', async () => {
    const resolved = await resolveEncounterOptionalCombatSnapshot({
      db: {} as DBLike,
      campaignId: ids.campaign,
      gameSystemId: ids.system,
      definitionIds: [ids.flanking, ids.facing]
    })

    expect(resolved.snapshot.definitions.map((definition) => definition.definitionId)).toEqual([
      ids.flanking,
      ids.facing
    ])
    expect(resolved.snapshot.definitions[0]?.document).toEqual(document(ids.flanking, 'FLANKING'))
    expect(resolved.checksum).toMatch(/^[a-f0-9]{64}$/)
  })

  it('freezes a valid empty snapshot for an unregistered System without capability lookup', async () => {
    const customSystemId = '00000000-0000-4000-8000-000000000099'
    mocks.requirePolicyModule.mockImplementation(() => {
      throw new Error('No capability contract is registered.')
    })

    const resolved = await resolveEncounterOptionalCombatSnapshot({
      db: {} as DBLike,
      campaignId: ids.campaign,
      gameSystemId: customSystemId,
      definitionIds: []
    })

    expect(resolved.snapshot).toEqual({
      schemaVersion: 1,
      gameSystemId: customSystemId,
      definitions: []
    })
    expect(resolved.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(mocks.requirePolicyModule).not.toHaveBeenCalled()
  })

  it('fails closed for a source not enabled by the Campaign', async () => {
    mocks.listUnavailableSources.mockResolvedValue([ids.source])

    await expect(
      resolveEncounterOptionalCombatSnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        definitionIds: [ids.flanking]
      })
    ).rejects.toThrow('sources are not enabled')
  })

  it('fails closed when current published content has the wrong System or a conflicting group', async () => {
    mocks.requireCurrent.mockResolvedValue({
      ...current(ids.flanking, 'FLANKING'),
      gameSystemId: ids.facing
    })
    await expect(
      resolveEncounterOptionalCombatSnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        definitionIds: [ids.flanking]
      })
    ).rejects.toThrow('does not match')

    mocks.requireCurrent.mockImplementation(async (id: string) =>
      id === ids.flanking
        ? current(id, 'FLANKING', 'positioning')
        : current(id, 'FACING', 'positioning')
    )
    await expect(
      resolveEncounterOptionalCombatSnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        definitionIds: [ids.flanking, ids.facing]
      })
    ).rejects.toThrow('incompatible')
  })

  it('rejects a published definition when its exact module contract is no longer supported', async () => {
    mocks.requirePolicyModule.mockImplementation(() => {
      throw new Error('No policy module is registered.')
    })

    await expect(
      resolveEncounterOptionalCombatSnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        definitionIds: [ids.flanking]
      })
    ).rejects.toThrow('not supported')
  })

  it('normalizes unavailable capability lookup to an optional-combat domain error before source access', async () => {
    mocks.requirePolicyModule.mockImplementation(() => {
      throw new Error('No capability contract is registered.')
    })

    await expect(
      resolveCurrentOptionalCombatSources({
        db: {} as DBLike,
        gameSystemId: ids.system,
        definitionIds: [ids.flanking]
      })
    ).rejects.toBeInstanceOf(OptionalCombatSourceError)
    expect(mocks.requireCurrent).toHaveBeenCalledWith(ids.flanking)
  })
})
