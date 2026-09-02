import { describe, expect, it } from 'vitest'

import type { EncounterActorRecord } from '@artificer-toolkit/db'
import { ACTIVATION_CODE, RANGE_KIND, TRIGGER } from '@artificer-toolkit/shared/core'
import { compileEffect } from '@artificer-toolkit/shared/compilers'

import type { EncounterFeatureActionCapabilityDescriptor } from '../rules/encounterFeatureActionCapabilityDiscovery.js'
import type { LockedEncounterActiveEffectCharacter } from './encounterActiveEffectTargetState.js'
import {
  movementReactionActionSourceCurrentnessChecksum,
  organizeEncounterMovementReactionDecisions,
  sealEncounterMovementReactionChoiceGroups
} from './encounterMovementReactionDecision.js'
import {
  discoverEncounterMovementReactionSources,
  encounterMovementReactionEvaluationSource
} from './encounterMovementReactionSources.js'

const SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const ACTOR_ID = '00000000-0000-4000-8000-000000000301'
const CHARACTER_ID = '00000000-0000-4000-8000-000000000302'
const TOKEN_A_ID = '00000000-0000-4000-8000-000000000303'
const TOKEN_B_ID = '00000000-0000-4000-8000-000000000304'
const EFFECT_ID = '00000000-0000-4000-8000-000000000305'
const ELIGIBILITY_ID = '00000000-0000-4000-8000-000000000306'
const FEATURE_ID = '00000000-0000-4000-8000-000000000307'
const SOURCE_VERSION_ID = '00000000-0000-4000-8000-000000000308'
const ACTION_ID = `${ACTOR_ID}:REACTION:${EFFECT_ID}`

const binding = {
  kind: 'MOVEMENT' as const,
  stage: 'BEFORE_LEAVE_REACH' as const,
  perceptionRequirement: 'SEE' as const,
  eligibilityDefinitionId: ELIGIBILITY_ID,
  movementInterruption: null
}

function actor(
  input: {
    id?: string
    kind?: 'CHARACTER' | 'CREATURE'
    sourceId?: string
  } = {}
): EncounterActorRecord {
  const kind = input.kind ?? 'CHARACTER'
  return {
    id: input.id ?? ACTOR_ID,
    encounterId: '00000000-0000-4000-8000-000000000309',
    kind,
    sourceId: input.sourceId ?? (kind === 'CHARACTER' ? CHARACTER_ID : FEATURE_ID),
    sourceRevision: 1,
    label: 'Reactor',
    systemId: SYSTEM_ID,
    stableTieKey: 'reactor',
    public: true,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    conditions: [],
    resources: {},
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    snapshot: {},
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z'
  }
}

function characterLocked(input: { rangeAmount?: number; compiled?: boolean } = {}) {
  const currentActor = actor()
  const candidate = {
    actionId: ACTION_ID,
    effectId: EFFECT_ID,
    sourceId: FEATURE_ID,
    mechanicFacts: {
      invocation: {
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
        range: {
          rangeKind: RANGE_KIND.DISTANCE,
          amount: input.rangeAmount ?? 5,
          unit: 'FEET'
        },
        savingThrow: null,
        reactionMovementTrigger: binding
      },
      outcomes: []
    }
  }
  const entry = {
    schemaVersion: 2,
    kind: 'CHARACTER_ACTION',
    actionId: ACTION_ID,
    effectId: EFFECT_ID,
    targetPolicy: {
      range: {
        id: 'reach',
        rangeKind: RANGE_KIND.DISTANCE,
        amount: 5,
        unit: 'FEET'
      },
      targeting: null,
      shape: null,
      pathOverrides: []
    },
    compilation:
      input.compiled === false
        ? { kind: 'MANUAL', reasonCode: 'NOT_NORMALIZED' }
        : {
            kind: 'COMPILED',
            published: {},
            resourceBinding: null,
            activeEffectPlan: null
          }
  }
  return {
    id: CHARACTER_ID,
    systemId: SYSTEM_ID,
    streamVersion: 1,
    actor: currentActor,
    mechanics: {
      rulePolicyInput: { actionCandidates: [candidate] },
      compiledActionEntryPoints: [entry]
    }
  } as unknown as LockedEncounterActiveEffectCharacter
}

function featureCapability(): EncounterFeatureActionCapabilityDescriptor {
  const compiledEffect = compileEffect({
    id: EFFECT_ID,
    order: 0,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
      activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
      range: {
        id: 'reach',
        rangeKind: RANGE_KIND.DISTANCE,
        amount: 10,
        unit: 'FEET'
      },
      reactionMovementTrigger: binding
    },
    paths: []
  })
  return {
    kind: 'ENCOUNTER_FEATURE',
    label: 'Reaction feature',
    gameSystemId: SYSTEM_ID,
    authoredRootKind: 'effect',
    entryPointDefinitionId: EFFECT_ID,
    effectId: EFFECT_ID,
    actionId: ACTION_ID,
    sourceId: FEATURE_ID,
    mechanicFacts: {
      invocation: {
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
        range: { rangeKind: RANGE_KIND.DISTANCE, amount: 10, unit: 'FEET' },
        savingThrow: null,
        reactionMovementTrigger: binding
      },
      outcomes: []
    },
    compiledEffect,
    encounterActorId: ACTOR_ID,
    creatureSourceId: FEATURE_ID,
    ownerFeatureId: FEATURE_ID,
    featureOptionId: null,
    ownerRuleDefinitionIds: [],
    optionRuleDefinitionIds: [],
    sourceRevision: 1,
    sourceVersionId: SOURCE_VERSION_ID,
    sourceChecksum: 'a'.repeat(64),
    authoredEffectChecksum: 'b'.repeat(64),
    compiledEffectChecksum: 'c'.repeat(64),
    featureResourceUse: null,
    attackMechanic: null
  }
}

describe('Encounter movement reaction source discovery', () => {
  it('uses committed Character action facts and keeps every authoritative token placement', () => {
    const currentActor = actor()
    const result = discoverEncounterMovementReactionSources({
      encounter: { actors: [currentActor], gameSystemId: SYSTEM_ID },
      actorIdByTokenId: new Map([
        [TOKEN_A_ID, ACTOR_ID],
        [TOKEN_B_ID, ACTOR_ID]
      ]),
      tokens: [{ id: TOKEN_B_ID }, { id: TOKEN_A_ID }],
      lockedCharacters: new Map([[CHARACTER_ID, characterLocked()]]),
      encounterFeatureCapabilities: []
    })

    expect(result.map((source) => source.reactorTokenId)).toEqual([TOKEN_A_ID, TOKEN_B_ID])
    expect(result[0]).toMatchObject({
      range: { rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' },
      source: {
        binding,
        capability: { actionId: ACTION_ID, gameSystemId: SYSTEM_ID }
      },
      action: {
        kind: 'CHARACTER_ACTION',
        actorId: ACTOR_ID,
        characterId: CHARACTER_ID
      }
    })
  })

  it('fails closed for a Manual Character entry and rejects stale normalized range', () => {
    const currentActor = actor()
    const common = {
      encounter: { actors: [currentActor], gameSystemId: SYSTEM_ID },
      actorIdByTokenId: new Map([[TOKEN_A_ID, ACTOR_ID]]),
      tokens: [{ id: TOKEN_A_ID }],
      encounterFeatureCapabilities: []
    }
    expect(
      discoverEncounterMovementReactionSources({
        ...common,
        lockedCharacters: new Map([[CHARACTER_ID, characterLocked({ compiled: false })]])
      })
    ).toEqual([])
    expect(() =>
      discoverEncounterMovementReactionSources({
        ...common,
        lockedCharacters: new Map([[CHARACTER_ID, characterLocked({ rangeAmount: 10 })]])
      })
    ).toThrow('range does not match')
  })

  it('never treats a compiled spell cast as a movement-reaction candidate', () => {
    const currentActor = actor()
    const locked = characterLocked() as unknown as {
      mechanics: { rulePolicyInput: Record<string, unknown>; compiledActionEntryPoints: unknown[] }
    }
    locked.mechanics.rulePolicyInput = { actionCandidates: [] }
    locked.mechanics.compiledActionEntryPoints = [
      {
        schemaVersion: 4,
        kind: 'CHARACTER_SPELL_CAST',
        actionId: 'spell-candidate',
        effectId: EFFECT_ID,
        spell: {},
        targetPolicy: {},
        compilation: { kind: 'COMPILED', activeEffectPlan: null, executionPlan: {} }
      }
    ]
    expect(
      discoverEncounterMovementReactionSources({
        encounter: { actors: [currentActor], gameSystemId: SYSTEM_ID },
        actorIdByTokenId: new Map([[TOKEN_A_ID, ACTOR_ID]]),
        tokens: [{ id: TOKEN_A_ID }],
        lockedCharacters: new Map([[CHARACTER_ID, locked as LockedEncounterActiveEffectCharacter]]),
        encounterFeatureCapabilities: []
      })
    ).toEqual([])
  })

  it('uses immutable Encounter feature capabilities without parsing actor labels', () => {
    const creature = actor({ kind: 'CREATURE' })
    const result = discoverEncounterMovementReactionSources({
      encounter: { actors: [creature], gameSystemId: SYSTEM_ID },
      actorIdByTokenId: new Map([[TOKEN_A_ID, ACTOR_ID]]),
      tokens: [{ id: TOKEN_A_ID }],
      lockedCharacters: new Map(),
      encounterFeatureCapabilities: [featureCapability()]
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      range: { rangeKind: 'DISTANCE', amount: 10, unit: 'FEET' },
      action: { kind: 'ENCOUNTER_FEATURE', actorId: ACTOR_ID }
    })
  })

  it('seals a locked Character choice with distinct contact, option, authority, and currentness identities', () => {
    const currentActor = actor()
    const [source] = discoverEncounterMovementReactionSources({
      encounter: { actors: [currentActor], gameSystemId: SYSTEM_ID },
      actorIdByTokenId: new Map([[TOKEN_A_ID, ACTOR_ID]]),
      tokens: [{ id: TOKEN_A_ID }],
      lockedCharacters: new Map([[CHARACTER_ID, characterLocked()]]),
      encounterFeatureCapabilities: []
    })
    if (!source || source.action.kind !== 'CHARACTER_ACTION') {
      throw new Error('Expected one locked Character reaction source.')
    }
    const contactSourceId = 'd'.repeat(64)
    const organized = organizeEncounterMovementReactionDecisions([
      {
        candidate: {
          contact: { x: 5, y: 0 },
          movingActorId: '00000000-0000-4000-8000-000000000310',
          pathDistance: 5,
          reactorActorId: ACTOR_ID,
          reactorTokenId: TOKEN_A_ID,
          sourceId: contactSourceId,
          stage: 'BEFORE_LEAVE_REACH'
        },
        source: encounterMovementReactionEvaluationSource(source),
        policy: {
          eligible: true,
          allowanceDefinitionId: '00000000-0000-4000-8000-000000000311',
          allowanceMaximum: 1,
          allowanceRefreshBoundary: 'START_OF_TURN',
          selectionPolicy: 'CHOICE',
          choiceDefinitionId: '00000000-0000-4000-8000-0000000000d3',
          targetPolicy: 'MOVER'
        },
        evidence: {
          source: {
            definitionId: ELIGIBILITY_ID,
            gameSystemId: SYSTEM_ID,
            definitionFamilyKey: 'rules-runtime-graph',
            checksum: 'e'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          trace: [],
          outputs: {}
        }
      }
    ])
    const [sealed] = sealEncounterMovementReactionChoiceGroups(organized.choiceGroups)
    expect(sealed?.options[0]).toMatchObject({
      contactSourceId,
      actionId: ACTION_ID,
      actionSourceKind: 'CHARACTER_ACTION',
      authority: { kind: 'CHARACTER_CONTROLLER', characterId: CHARACTER_ID },
      visibility: 'CONTROLLER'
    })
    expect(sealed?.options[0]?.optionId).not.toBe(contactSourceId)
    expect(sealed?.options[0]?.actionSourceCurrentnessChecksum).not.toBe(
      movementReactionActionSourceCurrentnessChecksum({
        ...source.action,
        characterStreamVersion: source.action.characterStreamVersion + 1
      })
    )
  })
})
