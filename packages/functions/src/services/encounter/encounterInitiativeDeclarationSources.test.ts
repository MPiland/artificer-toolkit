import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  encounter: '00000000-0000-4000-8000-000000000001',
  actor: '00000000-0000-4000-8000-000000000002',
  creature: '00000000-0000-4000-8000-000000000003',
  version: '00000000-0000-4000-8000-000000000004',
  feature: '00000000-0000-4000-8000-000000000005',
  effect: '00000000-0000-4000-8000-000000000006'
}

const state = vi.hoisted(() => ({
  discover: vi.fn(),
  assertCurrent: vi.fn()
}))

vi.mock('../rules/encounterFeatureActionCapabilityDiscoveryRegistry.js', () => ({
  discoverEncounterFeatureActionCapabilities: state.discover
}))
vi.mock('../rules/encounterFeatureActionCapabilityDiscovery.js', () => ({
  assertEncounterFeatureActionCapabilityCurrent: state.assertCurrent
}))

import {
  compileEncounterInitiativeDeclaration,
  createEncounterInitiativeDeclarationRequest
} from './encounterInitiativeDeclarationSources.js'

const featureCapability = {
  kind: 'ENCOUNTER_FEATURE' as const,
  actionId: 'feature-action',
  creatureSourceId: ids.creature,
  sourceRevision: 2,
  sourceVersionId: ids.version,
  sourceChecksum: 'a'.repeat(64),
  ownerFeatureId: ids.feature,
  featureOptionId: null,
  effectId: ids.effect,
  compiledEffectChecksum: 'b'.repeat(64),
  mechanicFacts: { invocation: { activation: { code: 'ACTION' } } },
  featureResourceUse: { chargeId: '00000000-0000-4000-8000-000000000007', cost: 2 },
  label: 'Creature strike'
}

describe('Encounter initiative declaration sources', () => {
  beforeEach(() => {
    state.discover.mockReset()
    state.assertCurrent.mockReset()
    state.discover.mockReturnValue([featureCapability])
  })

  it('seals and revalidates a Creature immutable Feature action', () => {
    const source = {
      kind: 'CREATURE' as const,
      actor: {
        id: ids.actor,
        sourceId: ids.creature,
        sourceRevision: 2,
        snapshot: { payload: { size: 'LARGE' } }
      },
      systemId: '00000000-0000-0000-0000-000000000001',
      actorRule: { initiativeModifier: 3 }
    }
    const request = createEncounterInitiativeDeclarationRequest({
      requestId: 'speed',
      encounterId: ids.encounter,
      round: 1,
      actorId: ids.actor,
      participantExpectedVersion: 0,
      controllerUserId: null,
      source: source as never
    })
    expect(request.primaryOptions).toEqual([
      expect.objectContaining({
        kind: 'CREATURE_FEATURE_ACTION',
        optionId: 'feature-action',
        label: 'Creature strike'
      })
    ])
    const result = compileEncounterInitiativeDeclaration({
      source: source as never,
      primary: { kind: 'CREATURE_FEATURE_ACTION', optionId: 'feature-action' },
      bonus: null
    })
    expect(state.assertCurrent).toHaveBeenCalledWith({
      actor: source.actor,
      capability: featureCapability
    })
    expect(result.declaration).toMatchObject({
      actorSize: 'LARGE',
      primary: {
        kind: 'CREATURE_FEATURE_ACTION',
        actorId: ids.actor,
        creatureSourceId: ids.creature,
        featureResourceUse: { cost: 2 }
      }
    })
  })

  it('issues and seals Custom factors only through the GM-adjudicated selection', () => {
    const source = { kind: 'CUSTOM' as const, actor: { id: ids.actor }, systemId: null }
    const request = createEncounterInitiativeDeclarationRequest({
      requestId: 'speed',
      encounterId: ids.encounter,
      round: 1,
      actorId: ids.actor,
      participantExpectedVersion: 0,
      controllerUserId: null,
      source: source as never
    })
    expect(request.primaryOptions).toEqual([
      expect.objectContaining({ kind: 'GM_ADJUDICATED', optionId: 'GM_ADJUDICATED' })
    ])
    expect(request.adjudicationFields).toEqual([
      expect.objectContaining({
        kind: 'SELECT',
        key: 'actorSize',
        options: expect.arrayContaining([{ value: 'MEDIUM', label: 'Medium' }])
      }),
      expect.objectContaining({
        kind: 'MULTI_SELECT',
        key: 'actionFactors',
        maximumSelections: 4
      }),
      expect.objectContaining({
        kind: 'NULLABLE_INTEGER',
        key: 'spellLevel',
        minimum: 0,
        maximum: 99
      })
    ])
    const result = compileEncounterInitiativeDeclaration({
      source: source as never,
      primary: {
        kind: 'GM_ADJUDICATED',
        optionId: 'GM_ADJUDICATED',
        actorSize: 'TINY',
        actionFactors: ['RANGED_LOADING', 'MELEE_HEAVY'],
        spellLevel: 4
      },
      bonus: null
    })
    expect(result.declaration).toEqual({
      actorSize: 'TINY',
      primary: {
        kind: 'GM_ADJUDICATED',
        optionId: 'GM_ADJUDICATED',
        actorId: ids.actor,
        actionFactors: ['MELEE_HEAVY', 'RANGED_LOADING'],
        spellLevel: 4
      },
      bonus: null
    })
  })

  it('projects exact Character action and spell labels, with conservative historical fallbacks', () => {
    const actionCandidate = {
      actionId: 'action:longsword',
      label: 'Longsword',
      mechanicFacts: { invocation: { activation: { code: 'ACTION' } } }
    }
    const spellCandidate = {
      candidateId: 'spell:shield',
      label: 'Shield',
      spellId: 'spell-id',
      castLevel: 1
    }
    const source = {
      kind: 'CHARACTER' as const,
      actor: { id: ids.actor },
      mechanics: {
        rulePolicyInput: {
          actionCandidates: [actionCandidate],
          spellCastCandidates: [spellCandidate]
        },
        compiledActionEntryPoints: [
          {
            actionId: actionCandidate.actionId,
            schemaVersion: 3,
            compilation: { kind: 'COMPILED', published: { checksum: 'c'.repeat(64) } }
          }
        ],
        rulePolicyOutput: { spellCastMechanics: [{ candidateId: spellCandidate.candidateId }] }
      }
    }
    const request = createEncounterInitiativeDeclarationRequest({
      requestId: 'speed',
      encounterId: ids.encounter,
      round: 1,
      actorId: ids.actor,
      participantExpectedVersion: 0,
      controllerUserId: null,
      source: source as never
    })
    expect(request.primaryOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ optionId: actionCandidate.actionId, label: 'Longsword' }),
        expect.objectContaining({ optionId: spellCandidate.candidateId, label: 'Shield' })
      ])
    )

    const legacyRequest = createEncounterInitiativeDeclarationRequest({
      requestId: 'speed',
      encounterId: ids.encounter,
      round: 1,
      actorId: ids.actor,
      participantExpectedVersion: 0,
      controllerUserId: null,
      source: {
        ...source,
        mechanics: {
          ...source.mechanics,
          rulePolicyInput: {
            actionCandidates: [{ ...actionCandidate, label: undefined }],
            spellCastCandidates: [{ ...spellCandidate, label: undefined }]
          }
        }
      } as never
    })
    expect(legacyRequest.primaryOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ optionId: actionCandidate.actionId, label: 'Action' }),
        expect.objectContaining({ optionId: spellCandidate.candidateId, label: 'Spell cast' })
      ])
    )
  })
})
