import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const ids = {
  system: '00000000-0000-4000-8000-000000000001',
  user: '00000000-0000-4000-8000-000000000002',
  campaign: '00000000-0000-4000-8000-000000000009',
  policy: '00000000-0000-4000-8000-000000000003',
  evaluation: '00000000-0000-4000-8000-000000000004',
  tie: '00000000-0000-4000-8000-000000000005',
  ability: '00000000-0000-4000-8000-000000000006',
  orderChoice: '00000000-0000-4000-8000-000000000007'
}
const mocks = vi.hoisted(() => ({
  findSystem: vi.fn(),
  requireCurrent: vi.fn(),
  listUnavailableSources: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createSystemRepository: () => ({ findById: mocks.findSystem }),
    createCampaignRepository: () => ({
      listContentSourceIdsNotEnabledForCampaign: mocks.listUnavailableSources
    }),
    createReusableDefinitionRepository: () => ({ requireCurrent: mocks.requireCurrent })
  }
})

const { resolveEncounterInitiativePolicySnapshot } = await import('./encounterInitiativePolicy.js')
const { resolveCurrentInitiativePolicySources } =
  await import('../rules/initiativePolicySourceAccess.js')

function system(schemaVersion: 2 | 3) {
  return {
    ...(schemaVersion === 2
      ? { schemaVersion: 2 as const }
      : {
          schemaVersion: 3 as const,
          initiativePolicy: { defaultDefinitionId: ids.policy }
        }),
    id: ids.system,
    label: 'Test System',
    rulesetCode: 'test',
    rulesetVersion: '1',
    alignments: [],
    abilities: [{ id: ids.ability, code: 'agility', label: 'Agility' }],
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
    userId: ids.user
  }
}

function graph(id: string) {
  return {
    schemaVersion: 1 as const,
    id,
    gameSystemId: ids.system,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes: [
      {
        id: 'resolve',
        operation: { key: 'initiative.resolve', contractVersion: 1 },
        inputs: { score: { kind: 'FACT' as const, factKey: 'initiative.score' } }
      }
    ],
    outputs: {
      total: { kind: 'NODE_OUTPUT' as const, nodeId: 'resolve', port: 'total' },
      available: { kind: 'LITERAL' as const, value: true }
    }
  }
}

function graphChecksum(id: string): string {
  return checksumRuleDocument(graph(id))
}

const policyDocument = {
  schemaVersion: 1 as const,
  kind: 'INITIATIVE_POLICY' as const,
  id: ids.policy,
  gameSystemId: ids.system,
  procedure: 'ACTOR_ROLL' as const,
  cadence: 'ENCOUNTER_START' as const,
  evaluationGraph: {
    definitionId: ids.evaluation,
    definitionVersion: 1,
    definitionChecksum: graphChecksum(ids.evaluation),
    scoreOutput: 'total',
    sortDirection: 'DESCENDING',
    automaticOutput: 'available'
  },
  orderChoiceGraph: {
    definitionId: ids.orderChoice,
    definitionVersion: 1,
    definitionChecksum: graphChecksum(ids.orderChoice),
    selectionOutput: 'total',
    minimumIndexFact: 'initiative.choice-min-index',
    maximumIndexFact: 'initiative.choice-max-index'
  },
  tieResolvers: [
    {
      definitionId: ids.tie,
      definitionVersion: 1,
      definitionChecksum: graphChecksum(ids.tie),
      scoreOutput: 'total',
      sortDirection: 'DESCENDING',
      automaticOutput: 'available',
      repeatOnTie: false,
      maximumAttempts: 1
    }
  ],
  defaultTieResolverDefinitionId: ids.tie
}

function current(input: {
  id: string
  checksum: string
  label: string
  family: string
  document: unknown
}) {
  return {
    id: input.id,
    gameSystemId: ids.system,
    contentSourceId: ids.user,
    definitionFamilyKey: input.family,
    label: input.label,
    description: null,
    document: input.document,
    checksum: input.checksum,
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-08-28T00:00:00.000Z',
    publishedBy: ids.user
  }
}

describe('Encounter initiative policy snapshot', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findSystem.mockResolvedValue(system(3))
    mocks.listUnavailableSources.mockResolvedValue([])
    mocks.requireCurrent.mockImplementation(async (id: string) => {
      if (id === ids.policy) {
        return current({
          id,
          checksum: checksumRuleDocument(policyDocument),
          label: 'Standard initiative',
          family: 'initiative-policy',
          document: policyDocument
        })
      }
      if (id === ids.evaluation) {
        return current({
          id,
          checksum: graphChecksum(ids.evaluation),
          label: 'Actor roll',
          family: 'rules-runtime-graph',
          document: graph(id)
        })
      }
      if (id === ids.tie) {
        return current({
          id,
          checksum: graphChecksum(ids.tie),
          label: 'Table decides',
          family: 'rules-runtime-graph',
          document: graph(id)
        })
      }
      if (id === ids.orderChoice) {
        return current({
          id,
          checksum: graphChecksum(ids.orderChoice),
          label: 'Table order',
          family: 'rules-runtime-graph',
          document: graph(id)
        })
      }
      throw new Error('not found')
    })
  })

  it('freezes exact policy and graph documents for a future-stable Encounter', async () => {
    const resolved = await resolveEncounterInitiativePolicySnapshot({
      db: {} as DBLike,
      campaignId: ids.campaign,
      gameSystemId: ids.system,
      settings: { initiativePolicyDefinitionId: null, initiativeTieDefinitionId: null }
    })

    expect(resolved?.snapshot.policy.definitionId).toBe(ids.policy)
    expect(resolved?.snapshot.evaluationGraph.document).toEqual(graph(ids.evaluation))
    expect(resolved?.snapshot.orderChoiceGraph.document).toEqual(graph(ids.orderChoice))
    expect(resolved?.snapshot.tieResolver.label).toBe('Table decides')
    expect(resolved?.snapshot.policy.document.tieResolvers).toContainEqual({
      definitionId: ids.tie,
      definitionVersion: 1,
      definitionChecksum: graphChecksum(ids.tie),
      scoreOutput: 'total',
      sortDirection: 'DESCENDING',
      automaticOutput: 'available',
      repeatOnTie: false,
      maximumAttempts: 1
    })
    expect(resolved?.checksum).toMatch(/^[a-f0-9]{64}$/)
  })

  it('retains the selected tie resolver repetition policy with its exact graph source', async () => {
    const resolved = await resolveCurrentInitiativePolicySources({
      db: {} as DBLike,
      gameSystemId: ids.system,
      policyDefinitionId: ids.policy,
      selectedTieDefinitionId: null
    })

    expect(resolved.selectedTieResolver).toEqual({
      definitionId: ids.tie,
      definitionVersion: 1,
      definitionChecksum: graphChecksum(ids.tie),
      scoreOutput: 'total',
      sortDirection: 'DESCENDING',
      automaticOutput: 'available',
      repeatOnTie: false,
      maximumAttempts: 1
    })
    expect(resolved.orderChoiceGraph.current.id).toBe(ids.orderChoice)
  })

  it('keeps a legacy System without a Campaign override on manual initiative', async () => {
    mocks.findSystem.mockResolvedValue(system(2))

    await expect(
      resolveEncounterInitiativePolicySnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        settings: { initiativePolicyDefinitionId: null, initiativeTieDefinitionId: null }
      })
    ).resolves.toBeNull()

    expect(mocks.requireCurrent).not.toHaveBeenCalled()
  })

  it('fails closed when a graph no longer matches the policy pin', async () => {
    mocks.requireCurrent.mockImplementation(async (id: string) => {
      if (id === ids.policy) {
        return current({
          id,
          checksum: checksumRuleDocument(policyDocument),
          label: 'Standard initiative',
          family: 'initiative-policy',
          document: policyDocument
        })
      }
      return current({
        id,
        checksum: 'd'.repeat(64),
        label: 'Changed graph',
        family: 'rules-runtime-graph',
        document: graph(id)
      })
    })

    await expect(
      resolveEncounterInitiativePolicySnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        settings: null
      })
    ).rejects.toThrow('exact published version')
  })

  it('fails closed when the policy document does not match its published checksum', async () => {
    mocks.requireCurrent.mockImplementation(async (id: string) => {
      if (id === ids.policy) {
        return current({
          id,
          checksum: 'd'.repeat(64),
          label: 'Tampered policy',
          family: 'initiative-policy',
          document: policyDocument
        })
      }
      throw new Error('not reached')
    })

    await expect(
      resolveEncounterInitiativePolicySnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        settings: null
      })
    ).rejects.toThrow('does not match its current published definition')
  })

  it('fails closed when an exact graph checksum does not match its document', async () => {
    mocks.requireCurrent.mockImplementation(async (id: string) => {
      if (id === ids.policy) {
        return current({
          id,
          checksum: checksumRuleDocument(policyDocument),
          label: 'Standard initiative',
          family: 'initiative-policy',
          document: policyDocument
        })
      }
      const document = graph(id)
      document.nodes[0].inputs.score.factKey = 'initiative.tampered'
      return current({
        id,
        checksum: graphChecksum(id),
        label: 'Tampered graph',
        family: 'rules-runtime-graph',
        document
      })
    })

    await expect(
      resolveEncounterInitiativePolicySnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        settings: null
      })
    ).rejects.toThrow('exact published version')
  })

  it('rejects an initiative policy whose source is outside the Campaign catalogues', async () => {
    mocks.listUnavailableSources.mockResolvedValue([ids.user])

    await expect(
      resolveEncounterInitiativePolicySnapshot({
        db: {} as DBLike,
        campaignId: ids.campaign,
        gameSystemId: ids.system,
        settings: null
      })
    ).rejects.toThrow('sources are not enabled')
  })
})
