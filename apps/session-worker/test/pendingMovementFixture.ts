import { writePendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import type { EncounterStore } from '@artificer-toolkit/encounter-persistence/store'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const checksum = (letter: string) => letter.repeat(64)

/**
 * Stores one PENDING spatial-movement decision, the rows the room reads to hold its Scene (D26): the
 * occurrence and its sealed snapshot, parsed by the persisted schemas. The paused d20 request is the
 * minimal frozen graph; the path crosses one fixed effect at the committed position.
 */
export async function insertPendingMovementDecision(
  db: EncounterStore,
  input: {
    campaignId: string
    encounterId: string
    encounterVersion: number
    sceneId: string
    sceneVersion: number
    tokenId: string
    userId: string
    sourceActorId: string
    gameSystemId: string
    now: string
    /** The crossed effect asks its target for a d20 save, which a "Roll dice" answers. */
    d20Evidence?: boolean
  }
) {
  const occurrenceId = crypto.randomUUID()
  const rootCommandId = crypto.randomUUID()
  const effectId = crypto.randomUUID()
  const path = [
    { x: 10, y: 10 },
    { x: 20, y: 10 }
  ]
  const definitionId = crypto.randomUUID()
  const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse({
    snapshotKind: 'KERNEL_EVIDENCE',
    schemaVersion: 1,
    occurrenceId,
    graph: {
      schemaVersion: 1,
      source: {
        definitionId,
        gameSystemId: input.gameSystemId,
        definitionFamilyKey: 'effect.action',
        checksum: checksum('a')
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [
        {
          id: 'd20',
          operation: { key: 'evidence.integer-range', contractVersion: 1 },
          inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
        }
      ],
      outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' } }
    },
    facts: {},
    nextNodeIndex: 0,
    nodeOutputs: {},
    trace: [],
    request: {
      requestId: 'd20',
      kind: 'INTEGER_RANGE',
      nodeId: 'd20',
      ordinal: 0,
      min: 1,
      max: 20
    },
    authority: 'APPLICATION_SERVICE',
    redaction: 'SERVER_ONLY',
    applicationContext: {
      kind: 'ENCOUNTER_SPATIAL_MOVEMENT',
      schemaVersion: 1,
      root: {
        commandId: rootCommandId,
        commandFingerprint: checksum('c'),
        initiatorUserId: input.userId,
        correlationId: null,
        encounterId: input.encounterId,
        sceneId: input.sceneId,
        tokenId: input.tokenId,
        expectedEncounterVersion: input.encounterVersion,
        expectedSceneVersion: input.sceneVersion,
        currentSceneVersion: input.sceneVersion,
        movementKind: 'VOLUNTARY',
        originalPath: path,
        pathChecksum: checksumRuleDocument(path),
        pathStartDistance: 5,
        currentPosition: { x: 15, y: 10 },
        resolutionCommands: []
      },
      selectionChecksum: checksum('d'),
      completedExecutions: [],
      currentCandidate: {
        ordinal: 0,
        candidate: {
          contact: { x: 15, y: 10 },
          effectId,
          pathDistance: 5,
          sourceActorId: input.sourceActorId,
          sourceMoved: false,
          targetActorId: input.sourceActorId,
          trigger: 'ENTER'
        },
        effect: {
          effectId,
          version: 1,
          definitionChecksum: checksum('e'),
          lifecycleChecksum: checksum('f'),
          placementChecksum: checksum('1'),
          spatialStateChecksum: checksum('2'),
          authoredEffectId: crypto.randomUUID(),
          compiledEntryId: crypto.randomUUID(),
          frozenGraphNodeId: 'd20',
          frozenSourceChecksum: checksum('3'),
          capabilityContractVersion: 1,
          activation: 'REPEATABLE',
          revealed: true,
          revealOnTrigger: false
        },
        target: { kind: 'ENCOUNTER_ACTOR', targetStateChecksum: checksum('4') },
        d20Policy: input.d20Evidence
          ? {
              requestNodeId: 'd20',
              rollMode: 'NORMAL',
              keep: 'FIRST',
              contributors: [],
              contributorChecksum: checksumRuleDocument([]),
              modifier: 0,
              dc: 10
            }
          : null,
        diceStage: null
      },
      remainingCandidates: []
    }
  })
  const occurrence = encounterStoredRuleOccurrenceSchema.parse({
    id: occurrenceId,
    campaignId: input.campaignId,
    encounterId: input.encounterId,
    rootCommandId,
    state: 'PENDING',
    version: 1,
    expectedEncounterVersion: input.encounterVersion,
    pendingSnapshotChecksum: await writePendingSnapshot(
      { db },
      { id: occurrenceId, encounterId: input.encounterId },
      snapshot
    ),
    completedAt: null,
    createdAt: input.now,
    updatedAt: input.now
  })
  await db.insert('encounterRuleOccurrences', occurrence)
  return occurrence
}
