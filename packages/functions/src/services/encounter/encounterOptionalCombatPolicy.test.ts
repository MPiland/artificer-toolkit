import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import {
  DND5E_CLEAVING_OPERATION_KEY,
  DND5E_DISARM_OPERATION_KEY,
  DND5E_OVERRUN_OPERATION_KEY,
  DND5E_SHOVE_ASIDE_OPERATION_KEY,
  DND5E_TUMBLE_OPERATION_KEY,
  type Dnd5eOptionalCombatRuleKindDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  system: '00000000-0000-4000-8000-000000000002',
  source: '00000000-0000-4000-8000-000000000003',
  flanking: '00000000-0000-4000-8000-000000000004',
  facing: '00000000-0000-4000-8000-000000000005',
  disarm: '00000000-0000-4000-8000-000000000006',
  overrun: '00000000-0000-4000-8000-000000000007',
  shoveAside: '00000000-0000-4000-8000-000000000008',
  tumble: '00000000-0000-4000-8000-000000000009',
  cleaving: '00000000-0000-4000-8000-00000000000a',
  athletics: '00000000-0000-4000-8000-00000000000b',
  acrobatics: '00000000-0000-4000-8000-00000000000c'
}

const simpleModuleKeys: Partial<Record<Dnd5eOptionalCombatRuleKindDto, string>> = {
  DISARM: DND5E_DISARM_OPERATION_KEY,
  OVERRUN: DND5E_OVERRUN_OPERATION_KEY,
  SHOVE_ASIDE: DND5E_SHOVE_ASIDE_OPERATION_KEY,
  TUMBLE: DND5E_TUMBLE_OPERATION_KEY,
  CLEAVING: DND5E_CLEAVING_OPERATION_KEY
}

const mocks = vi.hoisted(() => ({
  requireCurrent: vi.fn(),
  listUnavailableSources: vi.fn(),
  requirePolicyModule: vi.fn(),
  findActiveVocabulary: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createReusableDefinitionRepository: () => ({
      requireCurrent: mocks.requireCurrent
    }),
    createSystemVocabularySnapshotRepository: () => ({
      findActive: mocks.findActiveVocabulary
    }),
    createCampaignRepository: () => ({
      listContentSourceIdsNotEnabledForCampaign: mocks.listUnavailableSources
    })
  }
})

function systemVocabulary() {
  return {
    schemaVersion: 4 as const,
    id: ids.system,
    label: 'Test system',
    rulesetCode: 'test',
    rulesetVersion: '1',
    alignments: [],
    abilities: [{ id: '00000000-0000-4000-8000-0000000000d1', code: 'ABILITY', label: 'Ability' }],
    challengeRatings: [],
    conditionTypes: [],
    creatureTypes: [],
    currencies: [],
    damageTypes: [],
    heritages: [],
    languages: [],
    lifestyles: [],
    magicSchools: [],
    passives: [],
    rarities: [],
    senses: [],
    skills: [
      {
        id: ids.athletics,
        code: 'CHECK_A',
        label: 'Check A',
        governingAbilityDefinitionId: '00000000-0000-4000-8000-0000000000d1'
      },
      {
        id: ids.acrobatics,
        code: 'CHECK_B',
        label: 'Check B',
        governingAbilityDefinitionId: '00000000-0000-4000-8000-0000000000d1'
      }
    ],
    speeds: [],
    terrains: [],
    userId: ids.source
  }
}

vi.mock('../rules/platformRulesRuntime.js', () => ({
  requireInstalledGameSystemPolicyModule: mocks.requirePolicyModule
}))

const { resolveEncounterOptionalCombatSnapshot } =
  await import('./encounterOptionalCombatPolicy.js')
const { OptionalCombatSourceError, resolveCurrentOptionalCombatSources } =
  await import('../rules/optionalCombatSourceAccess.js')

function document(
  id: string,
  kind: Dnd5eOptionalCombatRuleKindDto,
  group: string | null = null,
  moduleKey = kind === 'FLANKING'
    ? 'd20.attack.flanking-opposition'
    : (simpleModuleKeys[kind] ?? 'scene.grid.square.alternating-diagonals')
) {
  return {
    schemaVersion: 1 as const,
    id,
    gameSystemId: ids.system,
    kind,
    module: { policyModuleKey: moduleKey, contractVersion: 1 },
    parameters: (() => {
      switch (kind) {
        case 'FLANKING':
          return {
            kind,
            participantCapabilityDefinitionId: '00000000-0000-4000-8000-000000000006'
          }
        case 'DISARM':
          return {
            kind,
            defenderCheckDefinitionIds: [ids.athletics, ids.acrobatics]
          }
        case 'OVERRUN':
          return {
            kind,
            initiatorCheckDefinitionId: ids.athletics,
            targetCheckDefinitionId: ids.athletics
          }
        case 'SHOVE_ASIDE':
          return {
            kind,
            initiatorCheckDefinitionId: ids.athletics,
            defenderCheckDefinitionIds: [ids.athletics, ids.acrobatics]
          }
        case 'TUMBLE':
          return {
            kind,
            initiatorCheckDefinitionId: ids.acrobatics,
            targetCheckDefinitionId: ids.acrobatics
          }
        case 'CLEAVING':
          return { kind, qualifyingAttackKind: 'MELEE', requiresUndamagedInitialTarget: true }
        default:
          return { kind }
      }
    })(),
    mutuallyExclusiveGroup: group
  }
}

function current(
  id: string,
  kind: Dnd5eOptionalCombatRuleKindDto,
  group: string | null = null,
  moduleKey?: string
) {
  const value = document(id, kind, group, moduleKey)
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
    mocks.findActiveVocabulary.mockResolvedValue({ document: systemVocabulary() })
    mocks.requireCurrent.mockImplementation(async (id: string) =>
      id === ids.flanking ? current(id, 'FLANKING') : current(id, 'FACING')
    )
  })

  it('freezes exact current definitions in a checksum-protected Encounter snapshot', async () => {
    const resolved = await resolveEncounterOptionalCombatSnapshot({
      db: {} as DBLike,
      campaignId: ids.campaign,
      gameSystemId: ids.system,
      definitionIds: [ids.flanking]
    })

    expect(resolved.snapshot.definitions.map((definition) => definition.definitionId)).toEqual([
      ids.flanking
    ])
    expect(resolved.snapshot.definitions[0]?.document).toEqual(document(ids.flanking, 'FLANKING'))
    expect(resolved.checksum).toMatch(/^[a-f0-9]{64}$/)
  })

  it('admits every selected pre-launch optional action and resolution definition', async () => {
    const selected = [
      [ids.disarm, 'DISARM'],
      [ids.overrun, 'OVERRUN'],
      [ids.shoveAside, 'SHOVE_ASIDE'],
      [ids.tumble, 'TUMBLE'],
      [ids.cleaving, 'CLEAVING']
    ] as const
    mocks.requireCurrent.mockImplementation(async (id: string) => {
      const entry = selected.find(([definitionId]) => definitionId === id)
      if (!entry) throw new Error('missing fixture')
      return current(entry[0], entry[1])
    })

    const resolved = await resolveEncounterOptionalCombatSnapshot({
      db: {} as DBLike,
      campaignId: ids.campaign,
      gameSystemId: ids.system,
      definitionIds: selected.map(([definitionId]) => definitionId)
    })

    expect(
      resolved.snapshot.definitions.map((definition) => definition.document.kind).sort()
    ).toEqual(selected.map(([, kind]) => kind).sort())
    expect(mocks.requirePolicyModule).toHaveBeenCalledTimes(selected.length)
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

  it('fails closed when current published content has the wrong System or a duplicate kind', async () => {
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
      id === ids.flanking ? current(id, 'FLANKING') : current(id, 'FLANKING')
    )
    await expect(
      resolveEncounterOptionalCombatSnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        definitionIds: [ids.flanking, ids.facing]
      })
    ).rejects.toThrow('duplicate rule kind')
  })

  it('rejects a foundation-only rule before an Encounter snapshot can advertise it', async () => {
    mocks.requireCurrent.mockResolvedValue(current(ids.facing, 'FACING'))

    await expect(
      resolveEncounterOptionalCombatSnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        definitionIds: [ids.facing]
      })
    ).rejects.toThrow('not available for Encounter execution')
  })

  it('rejects an integrated kind paired with the wrong policy module', async () => {
    mocks.requireCurrent.mockResolvedValue(
      current(ids.flanking, 'FLANKING', null, 'scene.grid.square.alternating-diagonals')
    )

    await expect(
      resolveEncounterOptionalCombatSnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        definitionIds: [ids.flanking]
      })
    ).rejects.toThrow('not available for Encounter execution')
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

  it.each([
    ['DISARM', ids.disarm],
    ['OVERRUN', ids.overrun],
    ['SHOVE_ASIDE', ids.shoveAside],
    ['TUMBLE', ids.tumble]
  ] as const)(
    'rejects %s when a pinned check definition is unavailable',
    async (kind, definitionId) => {
      const unavailableCheckId = '00000000-0000-4000-8000-0000000000dd'
      const unavailableDocument = {
        ...document(definitionId, kind),
        parameters:
          kind === 'DISARM'
            ? { kind, defenderCheckDefinitionIds: [unavailableCheckId] }
            : kind === 'SHOVE_ASIDE'
              ? {
                  kind,
                  initiatorCheckDefinitionId: ids.athletics,
                  defenderCheckDefinitionIds: [unavailableCheckId]
                }
              : {
                  kind,
                  initiatorCheckDefinitionId: unavailableCheckId,
                  targetCheckDefinitionId: ids.athletics
                }
      }
      mocks.requireCurrent.mockResolvedValue({
        ...current(definitionId, kind),
        document: unavailableDocument,
        checksum: checksumRuleDocument(unavailableDocument)
      })

      await expect(
        resolveCurrentOptionalCombatSources({
          db: {} as DBLike,
          gameSystemId: ids.system,
          definitionIds: [definitionId]
        })
      ).rejects.toThrow('check definitions are not available')
    }
  )

  it('rejects check references when the resolved vocabulary belongs to another System', async () => {
    mocks.requireCurrent.mockResolvedValue(current(ids.disarm, 'DISARM'))
    mocks.findActiveVocabulary.mockResolvedValue({
      document: { ...systemVocabulary(), id: ids.facing }
    })

    await expect(
      resolveCurrentOptionalCombatSources({
        db: {} as DBLike,
        gameSystemId: ids.system,
        definitionIds: [ids.disarm]
      })
    ).rejects.toThrow('check definitions are not available')
  })

  it('rejects check references against a legacy untyped vocabulary', async () => {
    mocks.requireCurrent.mockResolvedValue(current(ids.disarm, 'DISARM'))
    const vocabulary = systemVocabulary()
    mocks.findActiveVocabulary.mockResolvedValue({
      document: {
        ...vocabulary,
        schemaVersion: 3,
        skills: vocabulary.skills.map((skill) => ({
          id: skill.id,
          code: skill.code,
          label: skill.label
        })),
        initiativePolicy: { defaultDefinitionId: ids.flanking }
      }
    })

    await expect(
      resolveCurrentOptionalCombatSources({
        db: {} as DBLike,
        gameSystemId: ids.system,
        definitionIds: [ids.disarm]
      })
    ).rejects.toThrow('check definitions are not available')
  })
})
