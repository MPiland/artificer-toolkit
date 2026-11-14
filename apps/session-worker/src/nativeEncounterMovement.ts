import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { requireServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/rulesExecution'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { prepareEncounterMovementContinuation } from '@artificer-toolkit/rules-runtime/encounterMovementContinuation'
import { type PreparedSpatialMovementPlan } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementPreparation'
import { buildEncounterMovementReactionFacts } from '@artificer-toolkit/rules-runtime/encounterMovementReactionFacts'
import { createEncounterMovementReactionPerception } from '@artificer-toolkit/rules-runtime/encounterMovementReactionPerception'
import {
  discoverEncounterMovementReactionChoices,
  revalidateEncounterMovementReactionOption
} from '@artificer-toolkit/rules-runtime/encounterMovementReactionDiscovery'
import { StaleMovementReactionError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { evaluateEncounterMovementActionResponse } from '@artificer-toolkit/rules-runtime/encounterMovementActionResponse'
import { evaluateEncounterMovementPassageResponse } from '@artificer-toolkit/rules-runtime/encounterMovementPassageResponse'
import { evaluateEncounterMovementPassageContest } from '@artificer-toolkit/rules-runtime/encounterMovementPassageExecution'
import { prepareEncounterMovementPassageContest } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import { RULE_WARNINGS_MESSAGE } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  encounterConditionApproachWarnings,
  encounterConditionSources
} from '@artificer-toolkit/rules-runtime/encounterConditionMechanics'
import { prepareEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import {
  discoverEncounterMovementPassage,
  MovementBlockedError,
  prepareEncounterMovementPassageBoundary
} from '@artificer-toolkit/rules-runtime/encounterMovementPassageBoundary'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { admitsEncounterFacing } from '@artificer-toolkit/rules-runtime/encounterFacing'
import { availableEncounterMovementPassageChoice } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import { encounterMovementPassageFacts } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePolicy'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { readNativeLiveMovementInputs } from './nativeEncounterMovementInputs.js'
import { prepareNativeLiveMovementConcentration } from './nativeEncounterMovementConcentration.js'
import { type NativeLiveMovementMaintenanceProjection } from './nativeEncounterMaintenance.js'
import {
  nativeMovementSettlementInputs,
  nativeSpatialStepCallbacks,
  type CharacterFacts,
  type ContinuationInput,
  type NativeLiveMovementSettlement
} from './nativeSpatialContinuation.js'

/** Prepares an initial move or sealed response in the DO; ordered plans perform no writes. */
export async function prepareNativeLiveMovement(
  input: Parameters<typeof readNativeLiveMovementInputs>[0] & {
    occurredAt: string
    random(maximum: number): number
    retained?: Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>
  }
) {
  const captured = await readNativeLiveMovementInputs(input)
  const { state, save, response, system, spells, definitions, capture, spatialEffects, runtime } =
    captured
  if (save.input.type !== 'MOVE_SCENE_TOKEN' || save.input.expectedEncounterVersion === null)
    throw new Error('Movement requires an Encounter move.')
  // A move ends in a facing only when the Encounter's Facing rule allows that step (ATTACK-12).
  const { facingDegrees } = save.input
  if (facingDegrees !== undefined && !admitsEncounterFacing(state, facingDegrees))
    rejectDomain('FACING_UNAVAILABLE')
  const { random, scene } = input
  const { carefully } = save.input
  const userId = input.scope.expectedUserId
  // Each roll goes to its actor's controllers; the mover rolls for the actors they control.
  const autoRoll = captured.autoRollByActorId
  const finalActors = new Map(captured.actors.map((actor) => [actor.id, actor]))

  function factsFor(targets: ReadonlyMap<string, MovementTarget<CharacterFacts>>) {
    if (!captured.facts) throw new Error('Movement reaction facts are unavailable.')
    if (targets === captured.targets) return captured.facts
    return {
      ...buildEncounterMovementReactionFacts({
        state,
        targets,
        system,
        spells,
        definitions,
        userId,
        campaignOwnerUserId: captured.facts.campaignOwnerUserId
      }),
      runtime
    }
  }

  const loadDefinition = async (id: string) => {
    const current = await definitions.requireCurrent(id)
    return {
      definitionFamilyKey: current.definitionFamilyKey,
      gameSystemId: current.gameSystemId,
      current
    }
  }

  async function perceptionFor(targets: ReadonlyMap<string, MovementTarget<CharacterFacts>>) {
    const facts = factsFor(targets)
    if (targets === captured.targets && captured.resolvePerception)
      return { facts, resolvePerception: captured.resolvePerception }
    const resolvePerception = await createEncounterMovementReactionPerception({
      state,
      targets,
      movingTokenId: captured.token.id,
      actorIdByTokenId: captured.actorIdByTokenId,
      sceneId: scene.id,
      sceneVersion: scene.version,
      sceneGrid: scene.grid,
      scene: captured.perceptionScene,
      loadSystem: async () => system,
      loadDefinition,
      loadSpatialEffects: async () => spatialEffects
    })
    return { facts, resolvePerception }
  }

  async function continueMovement(step: ContinuationInput): Promise<{
    outcome: SceneSpatialPreparation['outcome']
    settlements: NativeLiveMovementSettlement[]
  }> {
    return prepareEncounterMovementContinuation<
      CharacterFacts,
      NativeLiveMovementMaintenanceProjection,
      PreparedSpatialMovementPlan<CharacterFacts>,
      NativeLiveMovementSettlement
    >(step, {
      discoverPassage: async () => {
        try {
          // A creature the mover drags moves with it, so it never blocks the mover's way (D105),
          // nor does one the mover follows.
          return discoverEncounterMovementPassage({
            ...step,
            sceneTokens: step.sceneTokens.filter(
              ({ id }) =>
                !captured.drag?.tokens.some(({ tokenId }) => tokenId === id) &&
                !captured.followedTokenIds.has(id)
            ),
            actors: captured.actors,
            passage: encounterMovementPassageFacts(
              step.targets,
              step.actorIdByTokenId.get(step.root.tokenId)
            )
          })
        } catch (error) {
          // The message names no creature, so a fogged hostile at the endpoint stays hidden.
          if (error instanceof MovementBlockedError) rejectDomain('MOVEMENT_BLOCKED')
          throw error
        }
      },
      ...nativeSpatialStepCallbacks(
        { state, userId, autoRoll, carefully, captured, random, finalActors },
        step
      ),
      preparePassage: async (args) => {
        try {
          return await prepareEncounterMovementPassageBoundary(
            {
              ...args,
              state,
              userId,
              occurrenceId: step.occurrenceId,
              sceneVersion: step.sceneVersion,
              origin: step.currentPosition
            },
            (choice) =>
              availableEncounterMovementPassageChoice(
                {
                  loadSystem: async () => system,
                  prepareEconomy: (economy) =>
                    prepareEncounterActionEconomy({
                      ...economy,
                      loadTarget: async () => economy.target,
                      definitions
                    })
                },
                choice
              )
          )
        } catch (error) {
          if (error instanceof MovementBlockedError) rejectDomain('MOVEMENT_BLOCKED')
          throw error
        }
      },
      currentReactionGroup: async ({ next, root, position, targets }) => {
        const perception = await perceptionFor(targets)
        try {
          for (const option of next.group.options)
            await revalidateEncounterMovementReactionOption({
              ...perception.facts,
              movementKind: root.movementKind,
              occurrenceId: step.occurrenceId,
              option,
              actorIdByTokenId: step.actorIdByTokenId,
              tokens: step.sceneTokens.map((token) =>
                token.id === root.tokenId ? { ...token, position } : token
              ),
              resolvePerception: perception.resolvePerception
            })
          return next
        } catch (error) {
          if (!(error instanceof StaleMovementReactionError)) throw error
        }
        // The reactor's source changed since this group was issued: discover it again as the move did.
        const { reactionTimeline } = await discoverEncounterMovementReactionChoices({
          ...perception.facts,
          grid: scene.grid,
          movementKind: root.movementKind,
          movingTokenId: root.tokenId,
          occurrenceId: step.occurrenceId,
          path: root.originalPath,
          actorIdByTokenId: step.actorIdByTokenId,
          // The Scene holds the mover at its boundary; the path begins where the move began.
          tokens: step.sceneTokens.map((token) =>
            token.id === root.tokenId ? { ...token, position: root.originalPath[0]! } : token
          ),
          resolvePerception: perception.resolvePerception
        })
        return (
          reactionTimeline.find(
            (entry) =>
              entry.group.reactorActorId === next.group.reactorActorId &&
              Math.abs(entry.group.pathDistance - next.group.pathDistance) <= 1e-8
          ) ?? null
        )
      },
      runtime: async () => runtime
    })
  }

  let planned: {
    outcome: SceneSpatialPreparation['outcome']
    settlements: NativeLiveMovementSettlement[]
  }
  if (!response) {
    // A willing move that ends closer to the source of a condition that forbids it breaks a rule
    // the mover may knowingly break (ADR 0034); a forced move never warns.
    const moverActorId = captured.actorIdByTokenId.get(captured.token.id)
    const mover = moverActorId ? captured.targets.get(moverActorId) : undefined
    const warnings =
      mover && save.input.movementKind !== 'FORCED'
        ? encounterConditionApproachWarnings({
            mechanics: mover.conditionMechanics,
            sources: encounterConditionSources(mover),
            grid: scene.grid,
            start: captured.token,
            end: { ...captured.token, position: save.input.path.at(-1)! },
            sourceTokens: new Map(
              scene.tokens.flatMap((token) => {
                const actorId = captured.actorIdByTokenId.get(token.id)
                return actorId ? [[actorId, token] as const] : []
              })
            )
          })
        : []
    const acknowledgedWarnings = save.input.acknowledgedWarnings ?? []
    if (!warnings.every((warning) => acknowledgedWarnings.includes(warning.code)))
      throw new LiveSessionDomainRejectionError(422, {
        code: 'DOMAIN_REJECTED',
        reason: 'RULE_WARNINGS',
        message: RULE_WARNINGS_MESSAGE,
        warnings
      })
    planned = await continueMovement({
      state,
      userId,
      autoRoll,
      root: {
        commandId: save.commandId,
        commandFingerprint: save.inputChecksum,
        initiatorUserId: userId,
        correlationId: save.input.correlationId,
        encounterId: state.id,
        sceneId: scene.id,
        tokenId: captured.token.id,
        expectedEncounterVersion: save.input.expectedEncounterVersion,
        expectedSceneVersion: save.input.expectedSceneVersion,
        movementKind: save.input.movementKind,
        originalPath: save.input.path
      },
      sceneVersion: scene.version,
      sceneTokens: scene.tokens,
      sceneGrid: scene.grid,
      actorIdByTokenId: captured.actorIdByTokenId,
      currentPosition: captured.token.position,
      occurrenceId: input.occurrenceId,
      occurrenceVersion: 0,
      executionCommandId: save.commandId,
      occurredAt: input.occurredAt,
      reactionTimeline: captured.reactions.reactionTimeline,
      targets: captured.targets
    })
  } else if (response.context.kind === 'ENCOUNTER_MOVEMENT_REACTION') {
    const evaluated = await evaluateEncounterMovementActionResponse(
      {
        state,
        snapshot: response.snapshot,
        context: response.context,
        resolution: response.answer,
        occurrenceId: input.occurrenceId,
        occurrenceVersion: response.command.expectedOccurrenceVersion,
        userId,
        autoRoll,
        responseCommand: response.responseCommand,
        occurredAt: input.occurredAt,
        runtime,
        sceneTokens: scene.tokens,
        sceneGrid: scene.grid,
        actorIdByTokenId: captured.actorIdByTokenId,
        targets: captured.targets,
        reactionChildren: response.reactionChildren,
        ...(input.retained ? { retained: input.retained } : {})
      },
      {
        prepareConcentration: async (args) => {
          const result = await prepareNativeLiveMovementConcentration({
            ...args,
            autoRoll,
            capture,
            runtime,
            random
          })
          for (const target of result.targets.values())
            finalActors.set(target.actor.id, target.actor)
          return result
        },
        continueMovement
      }
    )
    planned = {
      outcome:
        evaluated.outcome.kind === 'TERMINAL'
          ? { ...evaluated.outcome, resolutionCommands: evaluated.resolutionCommands }
          : evaluated.outcome,
      settlements: evaluated.settlements
    }
  } else if (
    response.context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' ||
    response.context.kind === 'ENCOUNTER_CONTEST_CHECK'
  ) {
    const evaluated = await evaluateEncounterMovementPassageResponse(
      {
        state,
        snapshot: response.snapshot,
        resolution: response.answer,
        occurrenceId: input.occurrenceId,
        occurrenceVersion: response.command.expectedOccurrenceVersion,
        userId,
        autoRoll,
        responseCommand: response.responseCommand,
        occurredAt: input.occurredAt,
        sceneTokens: scene.tokens,
        sceneGrid: scene.grid,
        actorIdByTokenId: captured.actorIdByTokenId,
        actors: captured.actors,
        ...(input.retained ? { retained: input.retained } : {})
      },
      {
        loadTargets: async (actorIds) =>
          new Map(
            actorIds.map((id) => {
              const target = captured.targets.get(id)
              if (!target) throw new Error('Movement passage target is unavailable.')
              return [id, target] as const
            })
          ),
        evaluateContest: async (contest) => {
          const result = await evaluateEncounterMovementPassageContest(contest, {
            prepareContest: (choice) =>
              prepareEncounterMovementPassageContest(
                {
                  loadSystem: async () => system,
                  prepareEconomy: (economy) =>
                    prepareEncounterActionEconomy({
                      ...economy,
                      loadTarget: async () => economy.target,
                      definitions
                    })
                },
                choice
              ),
            runtime: async () => runtime,
            rollD20: () => random(20) + 1
          })
          if (result.kind === 'COMPLETE') {
            const source = contest.targets.get(result.pending.sourceActorId)
            const economy = result.pending.actionEconomy
            if (!source || !economy) throw new Error('Movement passage allowance is unavailable.')
            finalActors.set(
              source.actor.id,
              encounterRunActorStateSchema.parse({
                ...source.actor,
                resources: withEncounterRuleUsageUsed(
                  source.actor,
                  economy.definitionId,
                  economy.beforeUsed + 1
                )
              })
            )
          }
          return result
        },
        continueMovement
      }
    )
    planned = {
      outcome:
        evaluated.outcome.kind === 'TERMINAL'
          ? { ...evaluated.outcome, resolutionCommands: evaluated.resolutionCommands }
          : evaluated.outcome,
      settlements: evaluated.settlements
    }
  } else {
    const resolution = response.answer
    if (
      resolution.kind !== 'ENTER_DICE' &&
      resolution.kind !== 'ENTER_INTEGER' &&
      resolution.kind !== 'SYSTEM_ROLL'
    )
      throw new Error('Movement response does not match the issued spatial evidence.')
    if (captured.reactions.firstBoundaryDistance !== null)
      throw new Error('Spatial movement reaction selection changed before response.')
    const evaluated = await continueMovement({
      state,
      userId,
      autoRoll,
      root: response.root,
      sceneVersion: response.root.currentSceneVersion,
      sceneTokens: scene.tokens,
      sceneGrid: scene.grid,
      actorIdByTokenId: captured.actorIdByTokenId,
      currentPosition: response.root.currentPosition,
      occurrenceId: input.occurrenceId,
      occurrenceVersion: response.command.expectedOccurrenceVersion + 1,
      executionCommandId: response.responseCommand.commandId,
      occurredAt: input.occurredAt,
      reactionTimeline: [],
      targets: captured.targets,
      evidence: {
        pendingSnapshot: requireServerKernelRuleExecutionPendingSnapshot(response.snapshot),
        resolution,
        resolutionCommand: {
          ...response.responseCommand,
          kind: resolution.kind,
          requestId: resolution.requestId
        }
      },
      ...(input.retained ? { retained: input.retained } : {})
    })
    if (evaluated.outcome.kind === 'UNINTERRUPTED')
      throw new Error('Movement response lost its retained evidence.')
    planned = {
      ...evaluated,
      outcome:
        evaluated.outcome.kind === 'TERMINAL'
          ? {
              ...evaluated.outcome,
              resolutionCommands: [...response.root.resolutionCommands, response.responseCommand]
            }
          : evaluated.outcome
    }
  }
  const { settlementInputs, rules } = nativeMovementSettlementInputs({
    state,
    actors: captured.actors,
    targets: captured.targets,
    finalActors,
    planned
  })
  return { ...captured, ...planned, settlementInputs, rules }
}
