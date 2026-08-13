import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DBLike,
  EncounterRecord,
  RulePackRecord,
  RulePackRevisionRecord
} from '@artificer-toolkit/db'
import { rulePackDocumentDtoSchema } from '@artificer-toolkit/schema/api/rules'

import { checksumRuleDocument } from '../rules/ruleChecksum.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000001',
  campaign: '00000000-0000-4000-8000-000000000002',
  command: '00000000-0000-4000-8000-000000000003',
  encounter: '00000000-0000-4000-8000-000000000004',
  pack: '00000000-0000-4000-8000-000000000005',
  revision: '00000000-0000-4000-8000-000000000006',
  session: '00000000-0000-4000-8000-000000000007',
  system: '00000000-0000-4000-8000-000000000008',
  template: '00000000-0000-4000-8000-000000000009'
}

const mocks = vi.hoisted(() => ({ updateActor: vi.fn() }))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createEncounterRepository: () => ({ updateActor: mocks.updateActor })
}))

import { resolveEncounterAction } from './encounterActionResolution.js'

function graph(targetActorId: string) {
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
              outcomes: JSON.stringify([
                {
                  kind: 'DAMAGE',
                  targetActorId,
                  amount: 3,
                  damageTypeId: null
                }
              ])
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

function fixture() {
  const document = rulePackDocumentDtoSchema.parse({
    schemaVersion: 1,
    models: { 'resolve-action': graph(ids.actor) },
    fixtures: []
  })
  const encounter: EncounterRecord = {
    id: ids.encounter,
    campaignId: ids.campaign,
    sessionId: ids.session,
    templateId: ids.template,
    templateVersion: 1,
    rulePackRevisionId: ids.revision,
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
    document,
    checksum: checksumRuleDocument(document),
    createdBy: ids.actor,
    activatedBy: ids.actor,
    activatedAt: encounter.createdAt,
    state: 'ACTIVE',
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt
  }
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
})
