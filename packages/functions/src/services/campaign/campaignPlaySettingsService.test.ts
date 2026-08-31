import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  save: vi.fn(),
  listCurrentDefinitions: vi.fn(),
  requireCurrentDefinition: vi.fn(),
  findSystem: vi.fn(),
  campaign: {
    lockCampaign: vi.fn(),
    listContentSourceIdsNotEnabledForCampaign: vi.fn()
  },
  resolveAuthority: vi.fn(),
  assertActiveMember: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignRepository: () => mocks.campaign,
    createCampaignSettingsRepository: () => ({
      find: mocks.find,
      save: mocks.save
    }),
    createSystemRepository: () => ({ findById: mocks.findSystem }),
    createReusableDefinitionRepository: () => ({
      listCurrentAvailableToCampaign: mocks.listCurrentDefinitions,
      requireCurrent: mocks.requireCurrentDefinition
    }),
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) => callback(_db)
  }
})

vi.mock('./campaignService.js', () => ({
  CampaignConflictError: class CampaignConflictError extends Error {},
  CampaignNotFoundError: class CampaignNotFoundError extends Error {},
  assertActiveCampaignMember: mocks.assertActiveMember,
  assertCampaignOwner: vi.fn(),
  assertCampaignWritable: vi.fn(),
  resolveCampaignAuthority: mocks.resolveAuthority
}))

const { getCampaignPlaySettings, getCampaignPlaySettingsOptions, saveCampaignPlaySettings } =
  await import('./campaignPlaySettingsService.js')

const campaignId = '00000000-0000-4000-8000-000000000001'
const userId = '00000000-0000-4000-8000-000000000002'
const gameSystemId = '00000000-0000-4000-8000-000000000003'
const initiativePolicyDefinitionId = '00000000-0000-4000-8000-000000000004'
const initiativeGraphDefinitionId = '00000000-0000-4000-8000-000000000005'
const initiativeTieDefinitionId = '00000000-0000-4000-8000-000000000006'
const alternateTieDefinitionId = '00000000-0000-4000-8000-000000000007'
const contentSourceId = '00000000-0000-4000-8000-000000000008'
const abilityId = '00000000-0000-4000-8000-000000000009'
const initiativeOrderChoiceDefinitionId = '00000000-0000-4000-8000-000000000010'
const optionalCombatDefinitionId = '00000000-0000-4000-8000-000000000011'
const foundationOptionalCombatDefinitionId = '00000000-0000-4000-8000-000000000012'
const settings = {
  campaignId,
  normalCadenceDays: 14,
  expectedDurationMinutes: 240,
  quorum: 3,
  absentCharacterPolicy: 'No shitstorm autopilot.',
  contentGuidance: 'Avoid the shitstorm.',
  allowedContentRules: 'No shitstorm exceptions.',
  tableConduct: 'No shitstorm insults.',
  contentBoundaries: 'No shitstorm gore.',
  safetyPractices: ['SESSION_ZERO'] as Array<'SESSION_ZERO'>,
  liveSafetyMethod: 'Say shitstorm stop.',
  automationMode: 'ASSISTED' as const,
  manualReminderMode: 'OFF' as const,
  initiativePolicyDefinitionId: null,
  initiativeTieDefinitionId: null,
  optionalCombatRuleDefinitionIds: [],
  version: 1,
  updatedAt: '2026-08-12T12:00:00.000Z'
}

function authority(role: 'OWNER' | 'PLAYER', contentMaturity: 'STANDARD' | 'MATURE') {
  return {
    campaign: { contentMaturity, gameSystemId },
    membership: { role, status: 'ACTIVE' }
  }
}

function systemV2() {
  return {
    schemaVersion: 2 as const,
    id: gameSystemId,
    label: 'Test System',
    rulesetCode: 'test',
    rulesetVersion: '1',
    alignments: [],
    abilities: [{ id: abilityId, code: 'agility', label: 'Agility' }],
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
    skills: [],
    speeds: [],
    terrains: [],
    userId
  }
}

function systemV3() {
  return {
    ...systemV2(),
    schemaVersion: 3 as const,
    initiativePolicy: { defaultDefinitionId: initiativePolicyDefinitionId }
  }
}

function graph(definitionId: string) {
  return {
    schemaVersion: 1 as const,
    id: definitionId,
    gameSystemId,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes: [
      {
        id: 'resolve',
        operation: { key: 'initiative.resolve', contractVersion: 1 },
        inputs: {
          score: { kind: 'FACT' as const, factKey: 'initiative.score' }
        }
      }
    ],
    outputs: {
      total: { kind: 'NODE_OUTPUT' as const, nodeId: 'resolve', port: 'total' },
      available: { kind: 'LITERAL' as const, value: true }
    }
  }
}

function initiativePolicyDocument() {
  return {
    schemaVersion: 1 as const,
    kind: 'INITIATIVE_POLICY' as const,
    id: initiativePolicyDefinitionId,
    gameSystemId,
    procedure: 'ACTOR_ROLL' as const,
    cadence: 'ENCOUNTER_START' as const,
    evaluationGraph: {
      definitionId: initiativeGraphDefinitionId,
      definitionVersion: 1,
      definitionChecksum: checksumRuleDocument(graph(initiativeGraphDefinitionId)),
      scoreOutput: 'total',
      sortDirection: 'DESCENDING',
      automaticOutput: 'available'
    },
    orderChoiceGraph: {
      definitionId: initiativeOrderChoiceDefinitionId,
      definitionVersion: 1,
      definitionChecksum: checksumRuleDocument(graph(initiativeOrderChoiceDefinitionId)),
      selectionOutput: 'total',
      minimumIndexFact: 'initiative.choice-min-index',
      maximumIndexFact: 'initiative.choice-max-index'
    },
    tieResolvers: [
      {
        definitionId: initiativeTieDefinitionId,
        definitionVersion: 1,
        definitionChecksum: checksumRuleDocument(graph(initiativeTieDefinitionId)),
        scoreOutput: 'total',
        sortDirection: 'DESCENDING',
        automaticOutput: 'available',
        repeatOnTie: false,
        maximumAttempts: 1
      }
    ],
    defaultTieResolverDefinitionId: initiativeTieDefinitionId
  }
}

function currentDefinition(input: {
  id: string
  family: 'dnd5e-optional-combat' | 'initiative-policy' | 'rules-runtime-graph'
  label?: string
  document: unknown
}) {
  return {
    id: input.id,
    gameSystemId,
    contentSourceId,
    definitionFamilyKey: input.family,
    label: input.label ?? input.family,
    description: null,
    document: input.document,
    checksum: checksumRuleDocument(input.document),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-08-28T00:00:00.000Z',
    publishedBy: userId
  }
}

function mockCurrentInitiativePolicy() {
  const policy = initiativePolicyDocument()
  mocks.requireCurrentDefinition.mockImplementation(async (definitionId: string) => {
    if (definitionId === initiativePolicyDefinitionId) {
      return currentDefinition({
        id: definitionId,
        family: 'initiative-policy',
        document: policy
      })
    }
    return currentDefinition({
      id: definitionId,
      family: 'rules-runtime-graph',
      document: graph(definitionId)
    })
  })
}

describe('Campaign play settings service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.find.mockResolvedValue(settings)
    mocks.save.mockResolvedValue(settings)
    mocks.campaign.lockCampaign.mockResolvedValue({ id: campaignId })
    mocks.campaign.listContentSourceIdsNotEnabledForCampaign.mockResolvedValue([])
    mocks.listCurrentDefinitions.mockResolvedValue([])
    mocks.findSystem.mockResolvedValue(systemV2())
  })

  it('lists only resolved Campaign initiative and optional-combat choices', async () => {
    mocks.resolveAuthority.mockResolvedValue(authority('OWNER', 'STANDARD'))
    const policy = initiativePolicyDocument()
    mocks.listCurrentDefinitions.mockResolvedValue([
      currentDefinition({
        id: initiativePolicyDefinitionId,
        family: 'initiative-policy',
        label: 'Standard initiative',
        document: policy
      }),
      currentDefinition({
        id: initiativeTieDefinitionId,
        family: 'rules-runtime-graph',
        label: 'Dexterity priority',
        document: graph(initiativeTieDefinitionId)
      }),
      currentDefinition({
        id: optionalCombatDefinitionId,
        family: 'dnd5e-optional-combat',
        label: 'Flanking',
        document: {
          schemaVersion: 1,
          kind: 'FLANKING',
          id: optionalCombatDefinitionId,
          gameSystemId,
          module: {
            policyModuleKey: 'd20.attack.flanking-opposition',
            contractVersion: 1
          },
          parameters: {
            kind: 'FLANKING',
            participantCapabilityDefinitionId: '00000000-0000-4000-8000-000000000012'
          },
          mutuallyExclusiveGroup: null
        }
      }),
      currentDefinition({
        id: foundationOptionalCombatDefinitionId,
        family: 'dnd5e-optional-combat',
        label: 'Facing',
        document: {
          schemaVersion: 1,
          kind: 'FACING',
          id: foundationOptionalCombatDefinitionId,
          gameSystemId,
          module: {
            policyModuleKey: 'scene.grid.square.facing',
            contractVersion: 1
          },
          parameters: { kind: 'FACING' },
          mutuallyExclusiveGroup: null
        }
      })
    ])

    await expect(getCampaignPlaySettingsOptions({} as DBLike, userId, campaignId)).resolves.toEqual(
      {
        initiativePolicies: [
          {
            definitionId: initiativePolicyDefinitionId,
            label: 'Standard initiative',
            defaultTieResolverDefinitionId: initiativeTieDefinitionId,
            tieResolvers: [
              {
                definitionId: initiativeTieDefinitionId,
                label: 'Dexterity priority'
              }
            ]
          }
        ],
        optionalCombatRules: [
          {
            definitionId: optionalCombatDefinitionId,
            kind: 'FLANKING',
            label: 'Flanking'
          }
        ]
      }
    )
  })

  it('does not advertise an integrated optional-combat kind with the wrong module', async () => {
    mocks.resolveAuthority.mockResolvedValue(authority('OWNER', 'STANDARD'))
    mocks.listCurrentDefinitions.mockResolvedValue([
      currentDefinition({
        id: optionalCombatDefinitionId,
        family: 'dnd5e-optional-combat',
        label: 'Mismatched flanking',
        document: {
          schemaVersion: 1,
          kind: 'FLANKING',
          id: optionalCombatDefinitionId,
          gameSystemId,
          module: {
            policyModuleKey: 'scene.grid.square.alternating-diagonals',
            contractVersion: 1
          },
          parameters: {
            kind: 'FLANKING',
            participantCapabilityDefinitionId: '00000000-0000-4000-8000-000000000012'
          },
          mutuallyExclusiveGroup: null
        }
      })
    ])

    await expect(
      getCampaignPlaySettingsOptions({} as DBLike, userId, campaignId)
    ).resolves.toMatchObject({
      optionalCombatRules: []
    })
  })

  it('masks shared Standard settings for players', async () => {
    mocks.resolveAuthority.mockResolvedValue(authority('PLAYER', 'STANDARD'))

    const result = await getCampaignPlaySettings({} as DBLike, userId, campaignId)

    expect(result.absentCharacterPolicy).not.toContain('shitstorm')
    expect(result.contentGuidance).toBe('Avoid the ****storm.')
    expect(result.allowedContentRules).not.toContain('shitstorm')
    expect(result.tableConduct).not.toContain('shitstorm')
    expect(result.contentBoundaries).not.toContain('shitstorm')
    expect(result.liveSafetyMethod).not.toContain('shitstorm')
  })

  it('preserves raw settings for the owner', async () => {
    mocks.resolveAuthority.mockResolvedValue(authority('OWNER', 'STANDARD'))

    await expect(getCampaignPlaySettings({} as DBLike, userId, campaignId)).resolves.toEqual(
      settings
    )
  })

  it('saves explicit automation settings through the existing owner/version path', async () => {
    mocks.resolveAuthority.mockResolvedValue(authority('OWNER', 'STANDARD'))
    const { version: _version, updatedAt: _updatedAt, ...saveInput } = settings

    await saveCampaignPlaySettings({} as DBLike, userId, {
      ...saveInput,
      automationMode: 'MANUAL',
      manualReminderMode: 'SUBTLE',
      expectedVersion: settings.version
    })

    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        automationMode: 'MANUAL',
        manualReminderMode: 'SUBTLE'
      })
    )
  })

  it('saves an empty optional-combat selection for an unregistered Campaign System', async () => {
    const customSystemId = '00000000-0000-4000-8000-000000000099'
    mocks.resolveAuthority.mockResolvedValue({
      campaign: { contentMaturity: 'STANDARD', gameSystemId: customSystemId },
      membership: { role: 'OWNER', status: 'ACTIVE' }
    })
    const { version: _version, updatedAt: _updatedAt, ...saveInput } = settings

    await expect(
      saveCampaignPlaySettings({} as DBLike, userId, {
        ...saveInput,
        expectedVersion: settings.version,
        optionalCombatRuleDefinitionIds: []
      })
    ).resolves.toEqual(settings)

    expect(mocks.requireCurrentDefinition).not.toHaveBeenCalled()
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ optionalCombatRuleDefinitionIds: [] })
    )
  })

  it('validates an initiative policy and its selected tie resolver before saving', async () => {
    mocks.resolveAuthority.mockResolvedValue(authority('OWNER', 'STANDARD'))
    mockCurrentInitiativePolicy()
    const { version: _version, updatedAt: _updatedAt, ...saveInput } = settings

    await saveCampaignPlaySettings({} as DBLike, userId, {
      ...saveInput,
      initiativePolicyDefinitionId,
      initiativeTieDefinitionId,
      expectedVersion: settings.version
    })

    expect(mocks.requireCurrentDefinition).toHaveBeenCalledWith(initiativePolicyDefinitionId)
    expect(mocks.campaign.listContentSourceIdsNotEnabledForCampaign).toHaveBeenCalledWith({
      campaignId,
      contentSourceIds: [contentSourceId]
    })
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        initiativePolicyDefinitionId,
        initiativeTieDefinitionId
      })
    )
  })

  it('validates the System default initiative policy when the Campaign has no override', async () => {
    mocks.resolveAuthority.mockResolvedValue(authority('OWNER', 'STANDARD'))
    mocks.findSystem.mockResolvedValue(systemV3())
    mockCurrentInitiativePolicy()
    const { version: _version, updatedAt: _updatedAt, ...saveInput } = settings

    await saveCampaignPlaySettings({} as DBLike, userId, {
      ...saveInput,
      initiativePolicyDefinitionId: null,
      initiativeTieDefinitionId: null,
      expectedVersion: settings.version
    })

    expect(mocks.requireCurrentDefinition).toHaveBeenCalledWith(initiativePolicyDefinitionId)
    expect(mocks.campaign.listContentSourceIdsNotEnabledForCampaign).toHaveBeenCalledWith({
      campaignId,
      contentSourceIds: [contentSourceId]
    })
  })

  it('rejects a tie resolver outside the selected initiative policy', async () => {
    mocks.resolveAuthority.mockResolvedValue(authority('OWNER', 'STANDARD'))
    mockCurrentInitiativePolicy()
    const { version: _version, updatedAt: _updatedAt, ...saveInput } = settings

    await expect(
      saveCampaignPlaySettings({} as DBLike, userId, {
        ...saveInput,
        initiativePolicyDefinitionId,
        initiativeTieDefinitionId: alternateTieDefinitionId,
        expectedVersion: settings.version
      })
    ).rejects.toThrow('Initiative tie resolver is not permitted by the selected policy.')

    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('rejects an initiative policy whose source is outside the Campaign catalogues', async () => {
    mocks.resolveAuthority.mockResolvedValue(authority('OWNER', 'STANDARD'))
    mocks.campaign.listContentSourceIdsNotEnabledForCampaign.mockResolvedValue([contentSourceId])
    mockCurrentInitiativePolicy()
    const { version: _version, updatedAt: _updatedAt, ...saveInput } = settings

    await expect(
      saveCampaignPlaySettings({} as DBLike, userId, {
        ...saveInput,
        initiativePolicyDefinitionId,
        initiativeTieDefinitionId,
        expectedVersion: settings.version
      })
    ).rejects.toThrow('Initiative policy sources are not enabled for this Campaign.')

    expect(mocks.save).not.toHaveBeenCalled()
  })
})
