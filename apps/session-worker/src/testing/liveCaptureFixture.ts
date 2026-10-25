import {
  liveSessionEncounterRulesResponseSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesRequest,
  type LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  ActiveRuleEffectOwner,
  ActiveRuleEffectRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { encounterOptionalCombatSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/optionalCombat'
import { prepareMaintainedEffectStateRecord } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { LiveCaptureReads } from '../nativeEncounterReads.js'

/** A canonical, deterministic UUID for test identities. */
export function testUuid(value: number) {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`
}

export const ENCOUNTER_ID = testUuid(0xe000)
const SIDE_ID = testUuid(0xe001)
export const CAMPAIGN_ID = testUuid(0xe004)
export const USER_ID = testUuid(0xe005)
/** The System of the captured Character fixture. */
export const GAME_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const TIMESTAMP = '2026-09-26T00:00:00.000Z'

/** The envelope every capture response carries; the planners only accumulate it. */
export const captureEnvelope = {
  revisions: (['SYSTEM', 'CAMPAIGN', 'PLAY'] as const).map((scope, index) => ({
    scope,
    id: testUuid(0x7e00 + index),
    revision: null
  }))
}

/**
 * Answers planner captures from `answer`, parsed by the response schema as the room's reads are, and
 * records every request in the order it was issued. Only tests of the planners' contract handling
 * (pagination, refusals) use it; movement and rules behavior runs through the real room.
 */
export function captureFake(
  answer: (
    request: LiveSessionEncounterRulesRequest
  ) => LiveSessionEncounterRulesResponse | Promise<LiveSessionEncounterRulesResponse>
) {
  const requests: LiveSessionEncounterRulesRequest[] = []
  async function capture(request: LiveSessionEncounterRulesRequest) {
    requests.push(request)
    return liveSessionEncounterRulesResponseSchema.parse(await answer(request))
  }
  const reads: LiveCaptureReads = {
    encounterRules: (input: LiveSessionEncounterRulesInput) => capture(input.request),
    prepareCharacter: () => {
      throw new Error('This fake serves Encounter captures only.')
    }
  }
  return { capture, reads, requests }
}

export function maintainedState(input: {
  id: string
  ownerActorId: string
  definitionId: string
  encounterId?: string
  definitionChecksum?: string
}) {
  return prepareMaintainedEffectStateRecord({
    id: input.id,
    encounterId: input.encounterId ?? ENCOUNTER_ID,
    ownerActorId: input.ownerActorId,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: input.definitionId,
      definitionChecksum: input.definitionChecksum ?? 'c'.repeat(64),
      provenance: {
        kind: 'ACTION',
        sourceActionId: 'maintained-source-action',
        sourceOccurrenceId: testUuid(0x4001)
      },
      sourceActorId: input.ownerActorId,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    },
    occurredAt: TIMESTAMP
  })
}

/** A persisted effect an owner holds, optionally depending on a maintained state. */
export function activeEffect(input: {
  id: string
  owner: ActiveRuleEffectOwner
  createdOrdinal: number
  maintainedEffectStateId?: string
  /** `ENCOUNTER` ties a Character-owned effect to the Run, as a maintained dependent is. */
  lifetimeScope?: 'OWNER' | 'ENCOUNTER'
}): ActiveRuleEffectRecord {
  const authoredEffectId = testUuid(0xb004)
  const compiledEntryId = testUuid(0xb005)
  const definition: ActiveRuleEffectDefinitionDto = {
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: ENCOUNTER_ID,
      sourceOccurrenceId: testUuid(0xb006),
      rootCommandId: testUuid(0xb007),
      sourceActorId: null
    },
    authoredEffectId,
    compiledEntryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId: authoredEffectId,
        gameSystemId: GAME_SYSTEM_ID,
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: compiledEntryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      anchor: 'HOLDER',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: input.lifetimeScope ?? 'OWNER',
      expiration: { kind: 'INDEFINITE' }
    },
    stateContributions: [
      { kind: 'CONDITION_OWNERSHIP', conditionId: testUuid(0xc001), baselinePresent: false }
    ]
  }
  const lifecycle = { schemaVersion: 1 as const, remainingTicks: null }
  return {
    id: input.id,
    owner: input.owner,
    sourceEncounterId: ENCOUNTER_ID,
    maintainedEffectStateId: input.maintainedEffectStateId ?? null,
    createdOrdinal: input.createdOrdinal,
    version: 1,
    definition,
    definitionChecksum: checksumRuleDocument(definition),
    lifecycle,
    lifecycleChecksum: checksumRuleDocument(lifecycle),
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  }
}

/** A Run actor: a Character reading `characterId`, or a Creature when none is given. */
export function runActor(input: { id: string; characterId?: string }): EncounterRunActorState {
  const common = {
    id: input.id,
    encounterId: ENCOUNTER_ID,
    label: 'Actor',
    public: true,
    controllerUserIds: [],
    initiative: null,
    manualOrder: null,
    healthDisplay: null,
    systemId: GAME_SYSTEM_ID,
    stableTieKey: input.id,
    gmNotes: null,
    sideId: SIDE_ID,
    resources: {},
    snapshot: {},
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  }
  return encounterRunActorStateSchema.parse(
    input.characterId
      ? {
          ...common,
          kind: 'CHARACTER',
          sourceId: input.characterId,
          frozenState: null,
          absence: null,
          form: null,
          disposition: 'FRIENDLY'
        }
      : {
          ...common,
          kind: 'CREATURE',
          sourceId: null,
          sourceRevision: null,
          currentHitPoints: 11,
          maxHitPoints: 11,
          tempHitPoints: 0,
          conditions: [],
          defeated: false,
          form: null,
          absence: null,
          disposition: 'HOSTILE'
        }
  )
}

/** An ACTIVE Encounter Run over the given actors, with no optional combat rules pinned. */
export function encounterRunState(input: {
  actors: readonly EncounterRunActorState[]
  automationMode?: 'MANUAL' | 'ASSISTED'
  version?: number
}) {
  const optionalCombat = encounterOptionalCombatSnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: GAME_SYSTEM_ID,
    definitions: []
  })
  return encounterRunStateSchema.parse({
    id: ENCOUNTER_ID,
    campaignId: CAMPAIGN_ID,
    gameSystemId: GAME_SYSTEM_ID,
    blueprintId: testUuid(0xe006),
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    name: 'Worker capture fixture',
    status: 'ACTIVE',
    automationMode: input.automationMode ?? 'ASSISTED',
    healthDisplayDefault: 'HIDDEN',
    version: input.version ?? 7,
    round: 1,
    currentActorId: input.actors[0]?.id ?? null,
    actorIds: input.actors.map((actor) => actor.id),
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot: optionalCombat,
    optionalCombatSnapshotChecksum: checksumRuleDocument(optionalCombat),
    turnSequence: 1,
    sides: [{ id: SIDE_ID, label: 'Side', sortOrder: 0 }],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
}
