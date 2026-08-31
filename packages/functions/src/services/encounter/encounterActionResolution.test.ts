import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DBLike,
  EncounterRecord,
  RulePackRecord,
  RulePackRevisionRecord
} from '@artificer-toolkit/db'
import { rulePackDocumentDtoSchema } from '@artificer-toolkit/schema/api/rules'
import {
  ENCOUNTER_ACTOR_MODEL_KEY,
  encounterActorRuleOutputSchema
} from '@artificer-toolkit/schema/api/encounterActorRules'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { RULE_MODEL_CONTRACT_VERSION } from '../rules/ruleModelContracts.js'
import { dnd5e2014EncounterActorModel } from '../rules/systems/dnd5e/2014/encounterActorSource.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000001',
  campaign: '00000000-0000-4000-8000-000000000002',
  command: '00000000-0000-4000-8000-000000000003',
  encounter: '00000000-0000-4000-8000-000000000004',
  pack: '00000000-0000-4000-8000-000000000005',
  revision: '00000000-0000-4000-8000-000000000006',
  session: '00000000-0000-4000-8000-000000000007',
  system: '00000000-0000-4000-8000-000000000008',
  template: '00000000-0000-4000-8000-000000000009',
  damageType: '00000000-0000-4000-8000-000000000010',
  condition: '00000000-0000-4000-8000-000000000011'
}

const mocks = vi.hoisted(() => ({ getRevision: vi.fn(), updateActor: vi.fn() }))

const damageProtectionCases: Array<
  [
    string,
    Array<{ kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'; damageTypeId: string }>,
    number
  ]
> = [
  ['immunity prevents typed damage', [{ kind: 'IMMUNITY', damageTypeId: ids.damageType }], 10],
  ['resistance halves typed damage', [{ kind: 'RESISTANCE', damageTypeId: ids.damageType }], 9],
  [
    'vulnerability doubles typed damage',
    [{ kind: 'VULNERABILITY', damageTypeId: ids.damageType }],
    4
  ],
  [
    'resistance and vulnerability cancel',
    [
      { kind: 'RESISTANCE', damageTypeId: ids.damageType },
      { kind: 'VULNERABILITY', damageTypeId: ids.damageType }
    ],
    7
  ]
]

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createEncounterRepository: () => ({ updateActor: mocks.updateActor }),
  createRulePackRepository: () => ({ getRevision: mocks.getRevision })
}))

import { resolveEncounterAction } from './encounterActionResolution.js'

function graph(
  targetActorId: string,
  outcome: Record<string, unknown> = {
    kind: 'DAMAGE',
    targetActorId,
    amount: 3,
    damageTypeId: null
  }
) {
  return {
    contentType: 'application/vnd.gorules.decision',
    edges: [
      { id: 'edge-1', type: 'edge', sourceId: 'input', targetId: 'decision' },
      { id: 'edge-2', type: 'edge', sourceId: 'decision', targetId: 'output' }
    ],
    nodes: [
      { id: 'input', name: 'Request', type: 'inputNode', position: { x: 0, y: 0 } },
      {
        id: 'decision',
        name: 'Resolve action',
        type: 'decisionTableNode',
        position: { x: 200, y: 0 },
        content: {
          hitPolicy: 'first',
          inputs: [
            {
              id: 'remaining',
              name: 'Remaining charges',
              type: 'expression',
              field: 'action.choices.remainingCharges'
            }
          ],
          outputs: [
            {
              id: 'allowed',
              name: 'Allowed',
              type: 'expression',
              field: 'eligibility.allowed'
            },
            {
              id: 'reason',
              name: 'Reason',
              type: 'expression',
              field: 'eligibility.reasonCode'
            },
            { id: 'rolls', name: 'Rolls', type: 'expression', field: 'rollRequests' },
            { id: 'outcomes', name: 'Outcomes', type: 'expression', field: 'outcomes' }
          ],
          rules: [
            {
              _id: 'available',
              remaining: '> 0',
              allowed: 'true',
              reason: '"ALLOWED"',
              rolls: '[]',
              outcomes: JSON.stringify([outcome])
            },
            {
              _id: 'empty',
              remaining: '',
              allowed: 'false',
              reason: '"NO_CHARGES"',
              rolls: '[]',
              outcomes: '[]'
            }
          ]
        }
      },
      { id: 'output', name: 'Response', type: 'outputNode', position: { x: 400, y: 0 } }
    ]
  }
}

function actorRules(
  input: {
    defenses?: Array<{ kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'; damageTypeId: string }>
    conditionImmunityIds?: string[]
    status?: 'NORMALIZED' | 'NOT_NORMALIZED'
  } = {}
) {
  return encounterActorRuleOutputSchema.parse({
    actors: [
      {
        actorId: ids.actor,
        initiativeModifier: 0,
        featureResources: [],
        targetProtection:
          input.status === 'NOT_NORMALIZED'
            ? { status: 'NOT_NORMALIZED' }
            : {
                status: 'NORMALIZED',
                defenses: input.defenses ?? [],
                conditionImmunityIds: input.conditionImmunityIds ?? []
              }
      }
    ]
  })
}

function fixture() {
  const document = rulePackDocumentDtoSchema.parse({
    schemaVersion: 1,
    models: {
      'resolve-action': graph(ids.actor),
      [ENCOUNTER_ACTOR_MODEL_KEY]: dnd5e2014EncounterActorModel
    },
    fixtures: []
  })
  const encounter: EncounterRecord = {
    id: ids.encounter,
    campaignId: ids.campaign,
    sessionId: ids.session,
    gameSystemId: ids.system,
    blueprintId: ids.template,
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    rulePackRevisionId: ids.revision,
    automationMode: 'ASSISTED',
    manualReminderMode: 'OFF',
    name: 'Rule test',
    status: 'ACTIVE',
    version: 1,
    round: 1,
    currentActorId: ids.actor,
    actors: [
      {
        id: ids.actor,
        encounterId: ids.encounter,
        kind: 'CREATURE',
        sourceId: ids.actor,
        sourceRevision: null,
        label: 'Target',
        systemId: ids.system,
        stableTieKey: ids.actor,
        public: true,
        currentHitPoints: 10,
        maxHitPoints: 10,
        tempHitPoints: 0,
        conditions: [],
        resources: {},
        gmNotes: null,
        initiative: 10,
        manualOrder: null,
        snapshot: { kind: 'CREATURE', payload: {} },
        createdAt: '2026-08-12T00:00:00.000Z',
        updatedAt: '2026-08-12T00:00:00.000Z'
      }
    ],
    reminders: [],
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z'
  }
  const pack: RulePackRecord = {
    id: ids.pack,
    rulesetCode: 'dnd5e',
    version: '2014',
    activeRevisionId: ids.revision,
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt
  }
  const revision: RulePackRevisionRecord = {
    id: ids.revision,
    rulePackId: ids.pack,
    revision: 1,
    evaluatorKind: 'ZEN',
    evaluatorVersion: '0.54.0',
    modelContractVersion: RULE_MODEL_CONTRACT_VERSION,
    document,
    checksum: checksumRuleDocument(document),
    createdBy: ids.actor,
    activatedBy: ids.actor,
    activatedAt: encounter.createdAt,
    state: 'ACTIVE',
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt
  }
  mocks.getRevision.mockResolvedValue(revision)
  return { document, encounter, pack, revision }
}

describe('Encounter action resolution', () => {
  beforeEach(() => vi.clearAllMocks())

  it('evaluates the pinned revision and applies a typed enemy outcome', async () => {
    const { encounter, pack, revision } = fixture()
    const result = await resolveEncounterAction({
      db: {} as DBLike,
      userId: ids.actor,
      encounter,
      pack,
      revision,
      actorRules: actorRules(),
      command: {
        encounterId: encounter.id,
        commandId: ids.command,
        expectedVersion: encounter.version,
        type: 'RESOLVE_ACTION',
        actorId: ids.actor,
        modelKey: 'resolve-action',
        targetActorIds: [ids.actor],
        selections: { remainingCharges: 1 },
        visibility: 'TABLE'
      }
    })

    expect(mocks.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.actor, currentHitPoints: 7 })
    )
    expect(result.evidence).toMatchObject({
      rulePackRevisionId: ids.revision,
      checksum: revision.checksum,
      proposedOutcomes: [{ kind: 'DAMAGE', targetActorId: ids.actor, amount: 3 }],
      appliedOutcomes: [{ status: 'APPLIED', after: { hitPoints: { current: 7 } } }]
    })
    expect(result.evidence.trace).not.toBeNull()
    expect(mocks.getRevision).toHaveBeenCalledTimes(1)
    expect(result.zenEvaluationMs).toBeGreaterThan(0)
  })

  it('returns a stable denial without mutating Encounter state', async () => {
    const { encounter, pack, revision } = fixture()
    await expect(
      resolveEncounterAction({
        db: {} as DBLike,
        userId: ids.actor,
        encounter,
        pack,
        revision,
        actorRules: actorRules(),
        command: {
          encounterId: encounter.id,
          commandId: ids.command,
          expectedVersion: encounter.version,
          type: 'RESOLVE_ACTION',
          actorId: ids.actor,
          modelKey: 'resolve-action',
          targetActorIds: [ids.actor],
          selections: { remainingCharges: 0 },
          visibility: 'PRIVATE'
        }
      })
    ).rejects.toMatchObject({ name: 'EncounterValidationError', message: 'NO_CHARGES' })
    expect(mocks.updateActor).not.toHaveBeenCalled()
  })

  it.each(damageProtectionCases)('%s', async (_name, defenses, expectedHitPoints) => {
    const { encounter, pack, revision } = fixture()
    const document = rulePackDocumentDtoSchema.parse({
      schemaVersion: 1,
      models: {
        'resolve-action': graph(ids.actor, {
          kind: 'DAMAGE',
          targetActorId: ids.actor,
          amount: 3,
          damageTypeId: ids.damageType
        }),
        [ENCOUNTER_ACTOR_MODEL_KEY]: dnd5e2014EncounterActorModel
      },
      fixtures: []
    })
    revision.document = document
    revision.checksum = checksumRuleDocument(document)

    await resolveEncounterAction({
      db: {} as DBLike,
      userId: ids.actor,
      encounter,
      pack,
      revision,
      actorRules: actorRules({ defenses }),
      command: {
        encounterId: encounter.id,
        commandId: ids.command,
        expectedVersion: encounter.version,
        type: 'RESOLVE_ACTION',
        actorId: ids.actor,
        modelKey: 'resolve-action',
        targetActorIds: [ids.actor],
        selections: { remainingCharges: 1 },
        visibility: 'TABLE'
      }
    })

    if (expectedHitPoints === 10) {
      expect(mocks.updateActor).not.toHaveBeenCalled()
    } else {
      expect(mocks.updateActor).toHaveBeenCalledWith(
        expect.objectContaining({ currentHitPoints: expectedHitPoints })
      )
    }
  })

  it('suppresses an exactly matching normalized condition immunity without mutating the actor', async () => {
    const { encounter, pack, revision } = fixture()
    const document = rulePackDocumentDtoSchema.parse({
      schemaVersion: 1,
      models: {
        'resolve-action': graph(ids.actor, {
          kind: 'CONDITION',
          targetActorId: ids.actor,
          conditionId: ids.condition,
          operation: 'APPLY'
        }),
        [ENCOUNTER_ACTOR_MODEL_KEY]: dnd5e2014EncounterActorModel
      },
      fixtures: []
    })
    revision.document = document
    revision.checksum = checksumRuleDocument(document)

    await resolveEncounterAction({
      db: {} as DBLike,
      userId: ids.actor,
      encounter,
      pack,
      revision,
      actorRules: actorRules({ conditionImmunityIds: [ids.condition] }),
      command: {
        encounterId: encounter.id,
        commandId: ids.command,
        expectedVersion: encounter.version,
        type: 'RESOLVE_ACTION',
        actorId: ids.actor,
        modelKey: 'resolve-action',
        targetActorIds: [ids.actor],
        selections: { remainingCharges: 1 },
        visibility: 'TABLE'
      }
    })

    expect(mocks.updateActor).not.toHaveBeenCalled()
  })

  it.each([
    [
      'DAMAGE',
      { kind: 'DAMAGE', targetActorId: ids.actor, amount: 3, damageTypeId: ids.damageType }
    ],
    [
      'CONDITION',
      {
        kind: 'CONDITION',
        targetActorId: ids.actor,
        conditionId: ids.condition,
        operation: 'APPLY'
      }
    ]
  ])('rejects %s for a non-normalized Creature target before mutation', async (_name, outcome) => {
    const { encounter, pack, revision } = fixture()
    const document = rulePackDocumentDtoSchema.parse({
      schemaVersion: 1,
      models: {
        'resolve-action': graph(ids.actor, outcome),
        [ENCOUNTER_ACTOR_MODEL_KEY]: dnd5e2014EncounterActorModel
      },
      fixtures: []
    })
    revision.document = document
    revision.checksum = checksumRuleDocument(document)

    await expect(
      resolveEncounterAction({
        db: {} as DBLike,
        userId: ids.actor,
        encounter,
        pack,
        revision,
        actorRules: actorRules({ status: 'NOT_NORMALIZED' }),
        command: {
          encounterId: encounter.id,
          commandId: ids.command,
          expectedVersion: encounter.version,
          type: 'RESOLVE_ACTION',
          actorId: ids.actor,
          modelKey: 'resolve-action',
          targetActorIds: [ids.actor],
          selections: { remainingCharges: 1 },
          visibility: 'TABLE'
        }
      })
    ).rejects.toMatchObject({ name: 'EncounterValidationError' })

    expect(mocks.updateActor).not.toHaveBeenCalled()
  })

  it('allows healing a non-normalized Creature target because no protection fact is needed', async () => {
    const { encounter, pack, revision } = fixture()
    encounter.actors[0] = { ...encounter.actors[0], currentHitPoints: 6 }
    const document = rulePackDocumentDtoSchema.parse({
      schemaVersion: 1,
      models: {
        'resolve-action': graph(ids.actor, {
          kind: 'HEAL',
          targetActorId: ids.actor,
          amount: 3,
          temporary: false
        }),
        [ENCOUNTER_ACTOR_MODEL_KEY]: dnd5e2014EncounterActorModel
      },
      fixtures: []
    })
    revision.document = document
    revision.checksum = checksumRuleDocument(document)

    await resolveEncounterAction({
      db: {} as DBLike,
      userId: ids.actor,
      encounter,
      pack,
      revision,
      actorRules: actorRules({ status: 'NOT_NORMALIZED' }),
      command: {
        encounterId: encounter.id,
        commandId: ids.command,
        expectedVersion: encounter.version,
        type: 'RESOLVE_ACTION',
        actorId: ids.actor,
        modelKey: 'resolve-action',
        targetActorIds: [ids.actor],
        selections: { remainingCharges: 1 },
        visibility: 'TABLE'
      }
    })

    expect(mocks.updateActor).toHaveBeenCalledWith(expect.objectContaining({ currentHitPoints: 9 }))
  })
})
