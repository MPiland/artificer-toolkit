import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { requireServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/rulesExecution'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import type { EncounterActionEconomyConsumption } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import {
  liveSessionMovementSettlementSchema,
  type LiveSessionMovementSettlement
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import { spatialEffectTransition } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementEffects'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput
} from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import {
  prepareEncounterMovementContinuation,
  type MovementContinuationInput
} from '@artificer-toolkit/rules-runtime/encounterMovementContinuation'
import {
  prepareEncounterSpatialMovement,
  projectPreparedSpatialMovementReceipt,
  type PreparedSpatialMovementPlan
} from '@artificer-toolkit/rules-runtime/encounterSpatialMovementPreparation'
import { buildEncounterMovementReactionFacts } from '@artificer-toolkit/rules-runtime/encounterMovementReactionFacts'
import {
  resolveEncounterAttackPerception,
  resolveEncounterBelievedAttackPerception
} from '@artificer-toolkit/rules-runtime/encounterAttackPerception'
import { createEncounterMovementReactionPerception } from '@artificer-toolkit/rules-runtime/encounterMovementReactionPerception'
import {
  discoverEncounterMovementReactionChoices,
  revalidateEncounterMovementReactionOption
} from '@artificer-toolkit/rules-runtime/encounterMovementReactionDiscovery'
import { StaleMovementReactionError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { prepareEncounterMovementReactionAction } from '@artificer-toolkit/rules-runtime/encounterMovementReactionPreparation'
import {
  executeEncounterMovementReactionAction,
  resumeEncounterMovementLegendaryResistance
} from '@artificer-toolkit/rules-runtime/encounterMovementReactionExecution'
import { replayEncounterMovementReactionAction } from '@artificer-toolkit/rules-runtime/encounterMovementReactionReplay'
import {
  planEncounterMovementReactionAction,
  type MovementReactionSettlementInput
} from '@artificer-toolkit/rules-runtime/encounterMovementReactionPlan'
import { discoverEncounterLegendaryResistanceCandidate } from '@artificer-toolkit/rules-runtime/encounterLegendaryResistanceDiscovery'
import { evaluateEncounterMovementActionResponse } from '@artificer-toolkit/rules-runtime/encounterMovementActionResponse'
import { evaluateEncounterMovementPassageResponse } from '@artificer-toolkit/rules-runtime/encounterMovementPassageResponse'
import { evaluateEncounterMovementPassageContest } from '@artificer-toolkit/rules-runtime/encounterMovementPassageExecution'
import { prepareEncounterMovementPassageContest } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import {
  encounterActionSpentTurnUses,
  prepareEncounterActionMechanics
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { RULE_WARNINGS_MESSAGE } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  encounterConditionApproachWarnings,
  encounterConditionSources
} from '@artificer-toolkit/rules-runtime/encounterConditionMechanics'
import { lockedRelationshipActionFacts } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { prepareEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import {
  discoverEncounterMovementPassage,
  MovementEndpointOccupiedError,
  prepareEncounterMovementPassageBoundary
} from '@artificer-toolkit/rules-runtime/encounterMovementPassageBoundary'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { availableEncounterMovementPassageChoice } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import type { MovementConcentrationSettlement } from '@artificer-toolkit/rules-runtime/encounterMovementConcentration'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { readNativeLiveMovementInputs } from './nativeEncounterMovementInputs.js'
import { measureNativeEnemyProximity } from './nativeAttackEnemyProximity.js'
import { readNativeLiveTurnUses } from './nativeTurnUses.js'
import {
  prepareNativeLiveMovementConcentration,
  readNativeLiveMovementConcentrationState
} from './nativeEncounterMovementConcentration.js'
import {
  prepareNativeLiveActionMaintenance,
  readNativeLiveMaintenanceCharacter,
  type NativeLiveMovementMaintenanceProjection
} from './nativeEncounterMaintenance.js'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'

type CharacterFacts = PreparedLiveCharacterSheet
type CharacterRow = Parameters<typeof readNativeLiveMaintenanceCharacter>[0]
type ContinuationInput = MovementContinuationInput<
  CharacterFacts,
  NativeLiveMovementMaintenanceProjection
>
type NativeLiveMovementSettlement =
  | { kind: 'SPATIAL'; plan: PreparedSpatialMovementPlan<CharacterFacts> }
  | { kind: 'REACTION'; plan: MovementReactionSettlementInput<CharacterFacts, CharacterRow> }
  | { kind: 'CONCENTRATION'; plan: MovementConcentrationSettlement }
  | {
      kind: 'PASSAGE'
      plan: {
        actor: EncounterRunActorState
        consumption: EncounterActionEconomyConsumption
        consumedGrants: ActiveRuleEffectRecord[]
      }
    }

/** Prepares an initial move or sealed response in the DO; ordered plans perform no writes. */
export async function prepareNativeLiveMovement(
  input: Parameters<typeof readNativeLiveMovementInputs>[0] & {
    occurredAt: string
    random(maximum: number): number
    retained?: Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>
  }
) {
  const captured = await readNativeLiveMovementInputs(input)
  const { state, save, response, system, definitions, capture, spatialEffects, runtime } = captured
  if (save.input.type !== 'MOVE_SCENE_TOKEN' || save.input.expectedEncounterVersion === null)
    throw new Error('Movement requires an Encounter move.')
  const { random, scene } = input
  const { carefully } = save.input
  const userId = input.scope.expectedUserId
  // Each roll goes to its actor's controllers; the mover rolls for the actors they control.
  const autoRoll = captured.autoRollByActorId
  const finalActors = new Map(captured.actors.map((actor) => [actor.id, actor]))
  const reactionSettlements = new Map<
    MovementReactionSettlementInput<CharacterFacts, CharacterRow>,
    Extract<LiveSessionMovementSettlement, { kind: 'REACTION' }>
  >()

  function factsFor(targets: ReadonlyMap<string, MovementTarget<CharacterFacts>>) {
    if (!captured.facts) throw new Error('Movement reaction facts are unavailable.')
    if (targets === captured.targets) return captured.facts
    return {
      ...buildEncounterMovementReactionFacts({
        state,
        targets,
        system,
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
      scene,
      loadSystem: async () => system,
      loadDefinition,
      loadSpatialEffects: async () => spatialEffects
    })
    return { facts, resolvePerception }
  }

  const discoverResistance: Parameters<
    typeof executeEncounterMovementReactionAction
  >[0]['discoverResistance'] = async ({ prepared }) =>
    prepared.target.kind === 'CREATURE'
      ? discoverEncounterLegendaryResistanceCandidate({
          encounter: prepared.state,
          targetActor: prepared.target,
          actorRules: prepared.actorRules,
          definitions
        })
      : null

  async function prepareReaction(
    reaction: Parameters<typeof prepareEncounterMovementReactionAction>[0]['revalidate'] & {
      targets: ReadonlyMap<string, MovementTarget<CharacterFacts>>
      maintenanceProjection?: NativeLiveMovementMaintenanceProjection
    }
  ) {
    // A reaction chosen from options that changed since they were issued is the client's stale view.
    return prepareEncounterMovementReactionAction({
      facts: factsFor(reaction.targets),
      revalidate: reaction,
      maintenanceProjection: reaction.maintenanceProjection,
      prepareMechanics: (mechanics) =>
        prepareEncounterActionMechanics({
          ...mechanics,
          overridable: false,
          // The reactor attacks from its token; the mover is the target at the contact point.
          loadAttackPerception: async ({ sourceFacts, targetFacts }) => {
            const { reactorTokenId, contact } = reaction.option.candidate
            const attackerToken = scene.tokens.find((token) => token.id === reactorTokenId)
            const movingToken = scene.tokens.find((token) => token.id === captured.token.id)
            if (!attackerToken || !movingToken)
              throw new Error('Movement reaction perception facts are stale.')
            const loaders = {
              gameSystemId: state.gameSystemId,
              loadDefinition,
              loadSystem: async () => system
            }
            const [actual, believed] = await Promise.all([
              resolveEncounterAttackPerception({
                ...loaders,
                attacker: sourceFacts,
                target: targetFacts,
                placement: {
                  scene,
                  sceneGrid: scene.grid,
                  attackerToken,
                  targetToken: { ...movingToken, position: contact },
                  spatialEffects
                }
              }),
              resolveEncounterBelievedAttackPerception({
                ...loaders,
                attacker: sourceFacts,
                target: targetFacts
              })
            ])
            return { actual, believed }
          },
          loadSource: async (source) => resolveEncounterActionSource({ ...source, system }),
          // The reaction attack is made from where the mover is in contact with the reactor.
          loadEnemyProximity: ({ sourceFacts, targetFacts }) =>
            measureNativeEnemyProximity({
              state,
              actors: captured.actors,
              attackerActorId: sourceFacts.actor.id,
              targetActorId: targetFacts.actor.id,
              grid: scene.grid,
              tokens: scene.tokens.flatMap((token) => {
                const actorId = captured.actorIdByTokenId.get(token.id)
                return actorId
                  ? [
                      {
                        actorId,
                        position:
                          token.id === captured.token.id
                            ? reaction.option.candidate.contact
                            : token.position,
                        height: token.height,
                        width: token.width,
                        rotationDegrees: token.rotationDegrees
                      }
                    ]
                  : []
              }),
              loadTarget: async (actor) => {
                const loaded = reaction.targets.get(actor.id)
                if (!loaded) throw new Error('Movement reaction target is unavailable.')
                return loaded
              },
              definitions
            }),
          loadTurnUses: () => readNativeLiveTurnUses(capture, mechanics.actor.id),
          loadRelationshipFacts: async (relationship) => {
            return lockedRelationshipActionFacts({
              actionEffectId: relationship.actionEffectId,
              sourceActorId: relationship.sourceActorId,
              targetActorId: relationship.targetActorId,
              targets: {
                activeEffectsByActorId: new Map(
                  [...reaction.targets].map(([id, target]) => [id, target.activeEffects])
                )
              }
            })
          }
        }),
      prepareMaintenance: (prepared, _actorUserId, maintenanceProjection) =>
        prepareNativeLiveActionMaintenance({
          prepared,
          capture,
          projection: maintenanceProjection,
          targets: reaction.targets,
          activeEffectsByActorId: new Map(
            [...reaction.targets].map(([id, target]) => [id, target.activeEffects])
          ),
          loadCarriedHolder: async (actor) => {
            const holder = reaction.targets.get(actor.id)
            if (!holder) throw new Error('Carried-grant holder is not in the movement reaction.')
            return holder
          }
        })
    }).catch((error: unknown) => {
      if (error instanceof StaleMovementReactionError)
        rejectDomain('VERSION_STALE', 'This reaction changed; refresh and choose again.')
      throw error
    })
  }

  function planReaction(
    plan: MovementReactionSettlementInput<CharacterFacts, CharacterRow>,
    actorUserId: string
  ) {
    const result = planEncounterMovementReactionAction(plan, actorUserId, (row) =>
      readNativeLiveMaintenanceCharacter(row, state.gameSystemId)
    )
    for (const target of result.projectedTargets.values())
      finalActors.set(target.actor.id, target.actor)
    reactionSettlements.set(plan, {
      kind: 'REACTION',
      // The same attack roll uses up the reactor's one-roll grants (Vicious Mockery's disadvantage)
      // and releases the condition an ending effect alone held (Invisibility).
      consumedGrants: result.consumedGrants,
      turnUses: encounterActionSpentTurnUses(
        plan.prepared.prepared,
        result.reactionExecution.execution.evidence
      ),
      execution: result.reactionExecution,
      resourceConsumption: plan.prepared.prepared.characterActionState?.resourceConsumption ?? null,
      createdEffects: result.effects.createdEffects,
      maintainedState: result.effects.maintainedState
    })
    return result
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
          return discoverEncounterMovementPassage({ ...step, actors: captured.actors })
        } catch (error) {
          // The message names no creature, so a fogged hostile at the endpoint stays hidden.
          if (error instanceof MovementEndpointOccupiedError) rejectDomain('MOVEMENT_BLOCKED')
          throw error
        }
      },
      evaluateSpatial: (spatial, targets, stageTerminalSettlement) =>
        prepareEncounterSpatialMovement({
          input: { ...spatial, carefully },
          state,
          userId,
          runtime: state.automationMode === 'MANUAL' ? undefined : runtime,
          random,
          spatialScope: {
            list: async () => spatialEffects,
            get: async (id) => spatialEffects.find((effect) => effect.id === id) ?? null
          },
          loadTargets: async (actorIds) =>
            new Map(
              actorIds.map((id) => {
                const target = targets.get(id)
                if (
                  !target ||
                  target.actor.id !== id ||
                  target.actor.encounterId !== state.id ||
                  target.actor.systemId !== state.gameSystemId ||
                  !state.actorIds.includes(id)
                )
                  throw new Error('Projected spatial target does not match the Run.')
                return [id, target] as const
              })
            ),
          determineConcentrationActorIds:
            state.automationMode === 'MANUAL'
              ? undefined
              : async (actorIds, selected) => {
                  const active = await Promise.all(
                    actorIds.map(async (targetActorId) =>
                      (await readNativeLiveMovementConcentrationState({
                        state,
                        targetActorId,
                        targets: selected,
                        projection: spatial.maintenanceProjection,
                        capture
                      }))
                        ? targetActorId
                        : null
                    )
                  )
                  return new Set(active.filter((id): id is string => id !== null))
                },
          settleTerminal: async (plan) => {
            if (plan.executions.length) {
              for (const { plan: settlement } of plan.mechanicsPlan.settlements)
                finalActors.set(settlement.updatedActor.id, settlement.updatedActor)
              stageTerminalSettlement(plan)
            }
            return projectPreparedSpatialMovementReceipt(plan)
          }
        }),
      spatialSettlement: (plan) => {
        for (const { plan: settlement } of plan.mechanicsPlan.settlements)
          finalActors.set(settlement.updatedActor.id, settlement.updatedActor)
        return { kind: 'SPATIAL', plan }
      },
      prepareConcentration: async ({ executionOrdinal, ...args }) => {
        const prepared = await prepareNativeLiveMovementConcentration({
          ...args,
          state,
          userId,
          autoRoll,
          occurrenceId: step.occurrenceId,
          sourceCommandId: step.executionCommandId,
          occurredAt: step.occurredAt,
          source: { kind: 'SPATIAL', executionOrdinal },
          capture,
          runtime,
          random
        })
        for (const target of prepared.targets.values())
          finalActors.set(target.actor.id, target.actor)
        return {
          ...prepared,
          settlements: prepared.settlements.map((plan) => ({
            kind: 'CONCENTRATION' as const,
            plan
          }))
        }
      },
      preparePassage: (args) =>
        prepareEncounterMovementPassageBoundary(
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
        ),
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
    const perception = await perceptionFor(captured.targets)
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
        actorIdByTokenId: captured.actorIdByTokenId,
        resolvePerception: perception.resolvePerception,
        targets: captured.targets,
        ...(input.retained ? { retained: input.retained } : {})
      },
      {
        prepareReaction,
        replayReaction: (reaction) =>
          replayEncounterMovementReactionAction({ ...reaction, discoverResistance }),
        executeReaction: (reaction) =>
          executeEncounterMovementReactionAction({ ...reaction, discoverResistance, random }),
        resumeResistance: (reaction) =>
          resumeEncounterMovementLegendaryResistance({ ...reaction, discoverResistance, random }),
        planReaction,
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
    response.context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST'
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
  const settlementInputs = planned.settlements.map((settlement): LiveSessionMovementSettlement => {
    if (settlement.kind === 'CONCENTRATION')
      return liveSessionMovementSettlementSchema.parse({
        kind: settlement.plan.kind === 'END' ? 'CONCENTRATION_END' : 'CONCENTRATION',
        execution: settlement.plan.execution
      })
    if (settlement.kind === 'REACTION') {
      const recorded = reactionSettlements.get(settlement.plan)
      if (!recorded) throw new Error('Prepared movement reaction settlement is missing.')
      return liveSessionMovementSettlementSchema.parse(recorded)
    }
    if (settlement.kind === 'PASSAGE')
      return liveSessionMovementSettlementSchema.parse({
        kind: 'PASSAGE',
        actorId: settlement.plan.actor.id,
        consumption: settlement.plan.consumption,
        consumedGrants: settlement.plan.consumedGrants
      })
    return liveSessionMovementSettlementSchema.parse({
      kind: 'SPATIAL',
      executions: settlement.plan.executions,
      transitions: [
        ...new Set(settlement.plan.executions.map((entry) => entry.candidate.candidate.effectId))
      ]
        .sort()
        .map((effectId) => {
          const effect = settlement.plan.effects.get(effectId)
          if (!effect) throw new Error('Prepared movement spatial effect is missing.')
          return { effectId, transition: spatialEffectTransition(effect) }
        })
    })
  })
  const ruleFacts =
    planned.outcome.kind === 'TERMINAL' || planned.settlements.length
      ? buildEncounterActorRuleFacts({
          actors: captured.actors.map((actor) => finalActors.get(actor.id)!)
        })
      : null
  const rules = ruleFacts
    ? bindEncounterActorRuleOutputToFacts(
        reconcileEncounterActorRuleOutput(
          evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: ruleFacts }),
          ruleFacts
        ),
        ruleFacts
      )
    : null
  return { ...captured, ...planned, settlementInputs, rules }
}
