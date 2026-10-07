import { encounterActorRelationship } from './encounterActionTargetPolicy.js'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { OptionalCombatPassageChoicePendingContextDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { serverAggregateChoicePendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { discoverEncounterMovementPassageContact } from './encounterMovementPassageContacts.js'
import type { PreparedSpatialMovementPlan } from './encounterSpatialMovementPreparation.js'
import type {
  SpatialMovementRuleEvaluation,
  SpatialMovementRuleRoot
} from './encounterSpatialMovementRuleService.js'

/** A voluntary move the player chose to end inside a hostile footprint; the caller refuses it. */
export class MovementEndpointOccupiedError extends Error {
  constructor() {
    super('Voluntary movement cannot end inside a hostile occupied footprint.')
  }
}

type Movement = OptionalCombatPassageChoicePendingContextDto['movement']
type Boundary = Extract<SpatialMovementRuleEvaluation, { kind: 'REACTION_BOUNDARY' }>

/** The complete original path determines hostile footprint contacts, including its endpoint. */
export function discoverEncounterMovementPassage(input: {
  state: EncounterRunState
  actors: readonly Pick<EncounterRunActorState, 'id' | 'disposition'>[]
  root: SpatialMovementRuleRoot
  sceneTokens: readonly SceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
}) {
  if (input.state.automationMode === 'MANUAL') return null
  const { actors } = input
  const source = actors.find((actor) => actor.id === input.actorIdByTokenId.get(input.root.tokenId))
  if (!source) throw new Error('Movement passage source is unavailable.')
  const discovery = discoverEncounterMovementPassageContact({
    actorIdByTokenId: input.actorIdByTokenId,
    movementKind: input.root.movementKind,
    movingTokenId: input.root.tokenId,
    path: input.root.originalPath,
    tokens: input.sceneTokens.map((token) =>
      token.id === input.root.tokenId ? { ...token, position: input.root.originalPath[0]! } : token
    ),
    isHostile: ({ blockerActorId }) => {
      const blocker = actors.find((actor) => actor.id === blockerActorId)
      // Disposition is the one source of hostility (ADR 0034, D13).
      return (
        !!blocker &&
        encounterActorRelationship(source.disposition, blocker.disposition) === 'HOSTILE'
      )
    }
  })
  if (discovery.kind === 'ENDPOINT_OCCUPIED') throw new MovementEndpointOccupiedError()
  if (discovery.kind !== 'CROSSING') return null
  const pin = (contact: typeof discovery.contact) => {
    const token = input.sceneTokens.find((entry) => entry.id === contact.blockerTokenId)
    if (!token) throw new Error('Movement passage blocker is unavailable.')
    return {
      ...contact,
      blockerCurrentnessChecksum: checksumRuleDocument({
        actorId: contact.blockerActorId,
        tokenId: contact.blockerTokenId,
        footprint: token
      })
    }
  }
  return {
    contact: pin(discovery.contact),
    nextPassageStop: discovery.laterContacts[0] ? pin(discovery.laterContacts[0]) : null,
    sourceActorId: source.id
  }
}

/** Spatial contacts at this distance have already been evaluated before the passage choice. */
export async function prepareEncounterMovementPassageBoundary<
  TCharacterFacts extends ProjectableCharacterFacts,
  TPlan extends PreparedSpatialMovementPlan<TCharacterFacts>
>(
  input: {
    state: EncounterRunState
    root: SpatialMovementRuleRoot
    boundary: Boundary | (Boundary & { preparedBoundary: Boundary; prefixSettlementPlan: TPlan })
    passage: NonNullable<ReturnType<typeof discoverEncounterMovementPassage>>
    reactionTimeline: Movement['reactionTimeline']
    occurrenceId: string
    sceneVersion: number
    origin: SceneToken['position']
    userId: string
    targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  },
  availableChoice: (args: {
    state: EncounterRunState
    movement: Movement
    sourceActorId: string
    userId: string
    targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  }) => Promise<OptionalCombatPassageChoicePendingContextDto | null>
) {
  const boundary =
    'preparedBoundary' in input.boundary && input.boundary.preparedBoundary
      ? input.boundary.preparedBoundary
      : input.boundary
  if (Math.abs(boundary.boundaryDistance - input.passage.contact.pathDistance) > 1e-8)
    throw new Error('Movement passage contact is not the current boundary.')
  const moved =
    checksumRuleDocument(input.origin) !== checksumRuleDocument(boundary.boundaryPosition)
  const movement: Movement = {
    root: {
      ...input.root,
      originalPath: [...input.root.originalPath],
      pathChecksum: checksumRuleDocument(input.root.originalPath),
      pathStartDistance: boundary.boundaryDistance,
      currentPosition: boundary.boundaryPosition,
      currentSceneVersion: input.sceneVersion + (moved ? 1 : 0),
      resolutionCommands: [...boundary.resolutionCommands]
    },
    blockerActorId: input.passage.contact.blockerActorId,
    blockerTokenId: input.passage.contact.blockerTokenId,
    contact: input.passage.contact.contact,
    contactPathDistance: input.passage.contact.pathDistance,
    blockerCurrentnessChecksum: input.passage.contact.blockerCurrentnessChecksum,
    nextPassageStop: input.passage.nextPassageStop,
    spatialSelectionChecksum: boundary.selectionChecksum,
    spatialCurrentnessChecksum: boundary.currentnessChecksum,
    completedSpatialExecutions: [...boundary.completedExecutions],
    appliedSpatialPrefix: boundary.appliedPrefix,
    completedReactionExecutions: [...boundary.completedReactionExecutions],
    remainingSpatialCandidates: [...boundary.remainingCandidates],
    reactionTimeline: [...input.reactionTimeline]
  }
  const projectedTargets =
    'prefixSettlementPlan' in input.boundary
      ? new Map([
          ...input.targets,
          ...input.boundary.prefixSettlementPlan.mechanicsPlan.projectedTargets
        ])
      : input.targets
  const context = await availableChoice({
    state: input.state,
    movement,
    sourceActorId: input.passage.sourceActorId,
    userId: input.userId,
    targets: projectedTargets
  })
  if (!context) return null
  return {
    kind: 'PENDING' as const,
    pendingSnapshot: serverAggregateChoicePendingSnapshotDtoSchema.parse({
      snapshotKind: 'AGGREGATE_CHOICE',
      schemaVersion: 1,
      occurrenceId: input.occurrenceId,
      optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
      applicationContext: context
    }),
    movementIntent: moved
      ? { tokenId: input.root.tokenId, position: boundary.boundaryPosition }
      : null
  }
}
