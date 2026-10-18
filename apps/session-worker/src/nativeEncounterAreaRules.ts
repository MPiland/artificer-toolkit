import {
  areaActionTargetOrigin,
  type AreaActionTargetDto,
  type RemoveAreaTargetInputDto,
  castChoiceOptionId,
  type ResolveEncounterActionInputDto,
  type ResolveEncounterActionTargetDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { EncounterFailedCounterDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { ServerAggregateChoicePendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { restoreEncounterActionPending } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import {
  liveSessionEncounterActionPendingInputSchema,
  liveSessionEncounterAreaCommitInputSchema,
  type LiveSessionForcedMovement
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse,
  LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import {
  encounterActionCurrentnessChecksum,
  prepareEncounterActionMechanics,
  prepareEncounterActionSource
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  encounterActionSuppressedWarning,
  evaluateEncounterActorsRuleWarnings,
  evaluateEncounterAreaRuleWarnings,
  overridesActionEconomy,
  RULE_WARNINGS_MESSAGE
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  encounterConditionFleeSources,
  encounterFleeActionWarnings
} from '@artificer-toolkit/rules-runtime/encounterConditionMechanics'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  decideEncounterAreaLegendaryResistance,
  encounterAreaLegendaryResistanceAudits,
  encounterTargetLegendaryResistance,
  offerEncounterAreaLegendaryResistance
} from '@artificer-toolkit/rules-runtime/encounterAreaLegendaryResistance'
import type { EncounterLegendaryResistanceSelection } from '@artificer-toolkit/rules-runtime/encounterLegendaryResistanceChoice'
import { discoverEncounterLegendaryResistanceCandidate } from '@artificer-toolkit/rules-runtime/encounterLegendaryResistanceDiscovery'
import {
  answerEncounterAreaTest,
  catchEncounterAreaActorIds,
  prepareEncounterAreaTests,
  settleEncounterAreaAction
} from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import {
  encounterActionTargetKind,
  encounterZoneChoiceTarget,
  evaluateEncounterAreaTargetPolicy,
  evaluateEncounterCasterCenteredAreaTarget,
  evaluateEncounterDirectedAreaTarget,
  evaluateEncounterZoneTarget
} from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import {
  buildEncounterAreaPendingSnapshot,
  encounterAreaTargetCommandId,
  encounterAreaSettled,
  encounterChosenActorEntries,
  encounterChosenActorsChecksum,
  holdEncounterAreaForcedMovement,
  landEncounterAreaForcedMovement,
  markEncounterAreaLegendaryResistanceDecided,
  markEncounterAreaSaveTested,
  removeEncounterAreaTargetFromSnapshot
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { buildEncounterActionPendingSnapshot } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { characterTotalLevel } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { chosenZonePlacement } from '@artificer-toolkit/rules-runtime/encounterZonePlacement'
import { actorFormEntry } from '@artificer-toolkit/encounter-persistence/actorFormPersistence'
import { refuseStaleCharacterAction } from '@artificer-toolkit/encounter-persistence/staleCharacterAction'
import type { EncounterActorFormCreature } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import { creatureFormFilterRefusal } from '@artificer-toolkit/rules-runtime/encounterFormChoice'
import {
  encounterActiveEffectPlan,
  prepareNativeActionEffectsPlan,
  prepareNativeZoneSourceGrantEffect
} from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import {
  buildEncounterJoinedMaintenanceTransition,
  buildEncounterMaintenanceTransition
} from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import {
  createNativeActiveEffect,
  nativeEffectOwner,
  projectNativeLiveMaintenanceOwners
} from './nativeEncounterSettlement.js'
import {
  planNativeEncounterActionMechanics,
  planNativeEncounterAreaSourceSpend
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import {
  buildEncounterActionStoredExecution,
  buildEncounterAreaStoredExecution
} from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { executeEncounterActorsAction } from '@artificer-toolkit/rules-runtime/encounterActorsActionExecution'
import { selectHitPointPoolTargets } from '@artificer-toolkit/rules-runtime/encounterHitPointPool'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { preparedCastsSpell } from '@artificer-toolkit/rules-runtime/encounterCastReactionDiscovery'
import {
  actionEndedEffects,
  actsAgainstEnemy,
  targetEndedEffects
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import {
  planEncounterPlacedZone,
  planEncounterZoneBands
} from '@artificer-toolkit/rules-runtime/encounterPlacedZone'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { projectEncounterActionTarget } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import { applyEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  snapshotAbilityScore,
  snapshotCreatureTypeId,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  findEncounterFeatureResource,
  reconcileEncounterActorRuleOutput
} from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  nativeConcentrationDamageApplications,
  nativeConcentrationDamageSourceLabels
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import {
  readNativeLiveAttackPerception,
  readNativeLivePointPerception,
  readNativeLivePointSight
} from './nativeAttackPerception.js'
import {
  captureActionEconomyDefinitions,
  evaluateNativeLiveActionEconomy
} from './nativeEncounterActionEconomy.js'
import {
  nativeLiveRelationshipFacts,
  refuseActionOutsideItsWindow,
  refuseUnmetBasicActionRestrictions,
  interpretForcedMovements
} from './nativeEncounterActionInputs.js'
import { planNativeLiveConcentration } from './nativeEncounterConcentration.js'
import {
  prepareNativeLiveActionMaintenance,
  prepareNativeLiveMaintainedState
} from './nativeEncounterMaintenance.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import {
  counterConsumptionsOf,
  type NativeCastReactionAnswer
} from './nativeEncounterCastReaction.js'
import { createNativeCastPause } from './nativeEncounterCastPause.js'

type AreaCommand = Omit<ResolveEncounterActionInputDto, 'target'> & {
  target: AreaActionTargetDto
}
type ChosenActorsCommand = Omit<ResolveEncounterActionInputDto, 'target'> & {
  target: Extract<ResolveEncounterActionTargetDto, { kind: 'ACTORS' }>
}
/** A command that opens or resumes a multi-creature action: a point area or a list of chosen creatures. */
type ReachCommand = Omit<ResolveEncounterActionInputDto, 'target'> & {
  target: AreaCommand['target'] | ChosenActorsCommand['target']
}
type MovementTargets = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']

/** The paused counter window an answer to a multi-creature cast resumes by replaying the cast. */
export type ReachCastResume = {
  response: ResolveRuleOccurrenceInputDto
  answer: NativeCastReactionAnswer
  initiatorUserId: string
  currentnessChecksum: string
  /** The counters that failed against the cast before this answer (D127). */
  failedCounters: readonly EncounterFailedCounterDto[]
}

/**
 * The pick a root's forced movements owe their source next on the Encounter's Scene (D157): the
 * farthest creature with two or more legal squares, the farther ones already landed; null when none is.
 */
export type ForcedMovementPick = (input: {
  encounterId: string
  sourceActorId: string
  movements: readonly LiveSessionForcedMovement[]
}) => Promise<{ targetActorId: string; positions: ScenePoint[] } | null>

/** What every multi-creature plan (a point area, a list of chosen creatures) reads from the room. */
export type AreaPlanBase = {
  /** Set when the plan replays a cast that paused for another Character's counter. */
  castResume?: ReachCastResume
  forcedMovementPick: ForcedMovementPick
  initial: LiveSessionEncounterRulesInput
  fingerprint: string
  state: EncounterRunState
  system: Extract<LiveSessionEncounterRulesResponse, { kind: 'INPUTS' }>['system']
  actors: readonly EncounterRunActorState[]
  activeEffectsByActorId: Map<string, ActiveRuleEffectRecord[]>
  loadTarget: (
    actor: EncounterRunActorState,
    effectsByActorId?: Map<string, ActiveRuleEffectRecord[]>
  ) => Promise<MovementTargets>
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => ReturnType<LiveCaptureReads['encounterRules']>
  runtime: RulesRuntimeService
  random?: (maximum: number) => number
  /** Whether the roller who answers this creature's save has "Auto-roll my dice" on. */
  requireAutoRoll: (actorId: string) => boolean
  /** Each actor's roller preference, for the Concentration checks the area's damage asks for. */
  autoRollByActorId: Readonly<Record<string, boolean>>
  /** Reads the Creature a form swaps in; absent where the room offers no creature sources. */
  readFormCreature?: (
    gameSystemId: string,
    creatureId: string
  ) => Promise<EncounterActorFormCreature>
}

type AreaPlanInput = AreaPlanBase & { command: AreaCommand }
type ReachPlanInput = AreaPlanBase & { command: ReachCommand }

/** Why an area is refused, as the player is told. */
const AREA_REFUSALS = {
  UNSUPPORTED_AREA: "This action's area size is not supported.",
  ORIGIN_OFF_CASTER: 'This area cannot extend from there.',
  AREA_TOO_LARGE: 'This area is larger than the action allows.',
  AREA_TOO_SMALL: 'This area is too small to place.',
  SIDE_REQUIRED: 'Pick the side of the wall this zone also reaches.',
  SIDE_NOT_OFFERED: 'This zone has no side to pick.'
} as const

/** What a command that names the wrong kind of target is told, by the target the action takes. */
const WRONG_TARGET_MESSAGES: Partial<Record<ResolveEncounterActionTargetDto['kind'], string>> = {
  POINT: 'This action must be aimed at a point on the map.',
  DIRECTED: 'This action must be aimed in a direction from the caster.',
  CASTER_CENTERED: 'This action is centered on the caster and takes no aim.',
  WALL: 'This action must be drawn as a wall between two points.',
  RING: 'This action must be drawn as a ring around a point.'
}

/**
 * The caster and the compiled source of a multi-creature action. The action takes the target its
 * policy names (a point, a direction from the caster, a list of chosen creatures), or for an action
 * that places a zone the target of the zone the caster picked (D154); a command that names another
 * kind is refused, saying what the action takes.
 */
export async function prepareCasterSource(
  input: AreaPlanBase & {
    command: Pick<
      ResolveEncounterActionInputDto,
      'actorId' | 'actionId' | 'target' | 'acceptedWieldConflict'
    >
  },
  targetKind: ResolveEncounterActionTargetDto['kind']
) {
  const { command, state, actors } = input
  const caster = actors.find((actor) => actor.id === command.actorId)
  if (!caster) throw new Error('Encounter rules input binding mismatch.')
  const casterFacts = await input.loadTarget(caster)
  const movementTargets = new Map([[caster.id, casterFacts]])
  const { source, targetPolicy } = await prepareEncounterActionSource({
    state,
    actor: caster,
    actionId: command.actionId,
    choiceOptionId: castChoiceOptionId(command.target),
    sourceFacts: casterFacts,
    loadSource: async (source) => resolveEncounterActionSource({ ...source, system: input.system })
  }).catch(refuseStaleCharacterAction)
  // An action that places a zone leaves it where it is aimed instead of putting anyone through it;
  // a cast-time pick places the zone the caster chose (D140).
  const zonePlacement =
    source.kind === 'CHARACTER_ACTION' && source.entry.schemaVersion === 4
      ? source.entry.compilation.zonePlacement
      : null
  const zone = zonePlacement
    ? chosenZonePlacement(zonePlacement, castChoiceOptionId(command.target))
    : null
  if (zonePlacement && !zone)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'Pick one of the zones this action offers.'
    })
  const takes = zone
    ? (encounterZoneChoiceTarget(zone, targetPolicy.range.rangeKind)?.kind ?? null)
    : encounterActionTargetKind(targetPolicy)
  if (takes !== targetKind)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: (takes && WRONG_TARGET_MESSAGES[takes]) ?? 'This action does not take that target.'
    })
  await refuseUnmetBasicActionRestrictions(
    { source, acceptedWieldConflict: command.acceptedWieldConflict },
    {
      target: casterFacts,
      gameSystemId: state.gameSystemId,
      definitions: captureActionEconomyDefinitions(input.capture),
      speedDefinitions: input.system.speeds,
      runEffectsByActorId: input.activeEffectsByActorId
    }
  )
  // A zone whose cast authors a save puts each creature in its area through it as it appears (D154).
  const appearSave =
    zonePlacement !== null &&
    source.kind === 'CHARACTER_ACTION' &&
    source.entry.schemaVersion === 4 &&
    source.entry.compilation.executionPlan.kind === 'TEST_OUTCOME'
  return { caster, casterFacts, movementTargets, source, targetPolicy, zone, appearSave }
}

/**
 * What every creature of one area shares: the caster, the Scene the point was picked in, the area,
 * and the zone it places. A list of chosen creatures inside an area passes the caster source it
 * already prepared.
 */
export async function prepareAreaScene(
  input: AreaPlanInput,
  prepared?: Awaited<ReturnType<typeof prepareCasterSource>>
) {
  const { command, state, capture } = input
  const { caster, casterFacts, movementTargets, targetPolicy, zone, appearSave } =
    prepared ?? (await prepareCasterSource(input, command.target.kind))
  const captured = await capture({
    kind: 'ACTION_AREA_SCENE',
    command: {
      actorId: command.actorId,
      sceneId: command.target.sceneId,
      expectedSceneVersion: command.target.expectedSceneVersion
    }
  })
  if (captured.kind !== 'ACTION_AREA_SCENE') throw new Error('Action Scene context is unavailable.')
  const scene = captured.context
  const grid = encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
    encounter: state,
    sceneGrid: scene.sceneGrid
  })
  const { target } = command
  const seen = async (point: ScenePoint) =>
    (await readNativeLivePointSight({
      state,
      system: input.system,
      observer: casterFacts,
      point,
      sceneContext: { sceneId: scene.sceneId, sceneVersion: scene.sceneVersion, grid },
      capture
    })) === 'SEES'
  const aimedPoints =
    target.kind === 'POINT'
      ? [target.point]
      : target.kind === 'WALL'
        ? [target.from, target.to]
        : target.kind === 'RING'
          ? [target.center]
          : []
  const area =
    zone && target.kind !== 'DIRECTED'
      ? evaluateEncounterZoneTarget({
          zone,
          range: targetPolicy.range,
          target,
          grid,
          sourceToken: scene.sourceToken,
          aimSeen: (await Promise.all(aimedPoints.map(seen))).every(Boolean)
        })
      : target.kind === 'CASTER_CENTERED'
        ? evaluateEncounterCasterCenteredAreaTarget({ targetPolicy, grid })
        : target.kind === 'DIRECTED'
          ? evaluateEncounterDirectedAreaTarget({
              targetPolicy,
              origin: target.origin,
              toward: target.toward,
              grid,
              sourceToken: scene.sourceToken
            })
          : target.kind === 'POINT'
            ? evaluateEncounterAreaTargetPolicy({
                targetPolicy,
                point: target.point,
                grid,
                sourceToken: scene.sourceToken,
                pointSeen: await seen(target.point)
              })
            : { refusal: 'UNSUPPORTED_AREA' as const }
  if (!area) throw new Error('The selected action area is not supported.')
  if ('refusal' in area)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: AREA_REFUSALS[area.refusal]
    })
  const origin =
    target.kind === 'CASTER_CENTERED' ? scene.sourceToken.position : areaActionTargetOrigin(target)
  const unaffectedActorIds = ('unaffectedActorIds' in target && target.unaffectedActorIds) || []
  if (
    unaffectedActorIds.length &&
    (!zone?.choosesUnaffected ||
      unaffectedActorIds.some((id) => !input.actors.some((actor) => actor.id === id)))
  )
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'This action cannot spare those creatures.'
    })
  return {
    caster,
    casterFacts,
    movementTargets,
    targetPolicy,
    scene: { ...scene, grid },
    area: { ...area, origin },
    placement: zone
      ? {
          zone,
          appearSave,
          origin,
          shape: area.shape,
          regions: 'regions' in area ? area.regions : [],
          sourceToken: scene.sourceToken ?? null,
          unaffectedActorIds
        }
      : null
  }
}

type AreaScene = Awaited<ReturnType<typeof prepareAreaScene>>
type ReachToken = AreaScene['scene']['tokens'][number]

/**
 * What a multi-creature action reaches: the caster, and the Scene and area the action was aimed in.
 * A list of chosen creatures may be aimed at no Scene at all, and at no area within one.
 */
export type AreaReach = Pick<
  AreaScene,
  'caster' | 'casterFacts' | 'movementTargets' | 'placement'
> & {
  scene: AreaScene['scene'] | null
  area: AreaScene['area'] | null
}

/**
 * The Scene a list of chosen creatures was aimed in. Positions are read only when the caster saw the
 * Scene; without them range is unchecked. An action that names an area is aimed at a point on it.
 */
export async function prepareChosenActorsReach(
  input: AreaPlanBase & { command: ChosenActorsCommand },
  sourced: Awaited<ReturnType<typeof prepareCasterSource>>
): Promise<AreaReach> {
  const { command, state, capture } = input
  const { caster, casterFacts, movementTargets, targetPolicy } = sourced
  const request = command.target.scene
  const reach = { caster, casterFacts, movementTargets, scene: null, area: null, placement: null }
  if (!request) return reach
  if (targetPolicy.shape !== null && request.point)
    return {
      ...(await prepareAreaScene(
        {
          ...input,
          command: {
            ...command,
            target: {
              kind: 'POINT',
              sceneId: request.sceneId,
              expectedSceneVersion: request.expectedSceneVersion,
              point: request.point
            }
          }
        },
        sourced
      )),
      placement: null
    }
  const captured = await capture({
    kind: 'ACTION_AREA_SCENE',
    command: {
      actorId: command.actorId,
      sceneId: request.sceneId,
      expectedSceneVersion: request.expectedSceneVersion
    }
  })
  if (captured.kind !== 'ACTION_AREA_SCENE') throw new Error('Action Scene context is unavailable.')
  return {
    ...reach,
    scene: {
      ...captured.context,
      grid: encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
        encounter: state,
        sceneGrid: captured.context.sceneGrid
      })
    }
  }
}

/** The reach of a pending multi-creature action, read again as the room stands now. */
async function prepareReach(input: ReachPlanInput): Promise<AreaReach> {
  const { command } = input
  if (command.target.kind !== 'ACTORS')
    return prepareAreaScene({ ...input, command: { ...command, target: command.target } })
  return prepareChosenActorsReach(
    { ...input, command: { ...command, target: command.target } },
    await prepareCasterSource(input, 'ACTORS')
  )
}

/** One creature's action mechanics against the point's Scene, as its sealed save was prepared. */
export async function prepareAreaTarget(
  input: ReachPlanInput & {
    base: AreaReach
    actor: EncounterRunActorState
    /** Null when the creature has no token on the Scene, or the action reaches no Scene. */
    token: ReachToken | null
  }
) {
  const { base, actor, token } = input
  const sceneContext =
    base.scene && token
      ? {
          sceneId: base.scene.sceneId,
          sceneVersion: base.scene.sceneVersion,
          sourceToken: base.scene.sourceToken,
          targetToken: token,
          grid: base.scene.grid
        }
      : null
  return {
    token,
    sceneContext,
    prepared: await prepareCasterActionOnTarget(input, {
      caster: base.caster,
      target: actor,
      movementTargets: base.movementTargets,
      sceneContext,
      origin:
        base.scene && base.area
          ? {
              point: base.area.origin,
              sceneId: base.scene.sceneId,
              sceneVersion: base.scene.sceneVersion
            }
          : undefined
    })
  }
}

/**
 * The caster's action mechanics against one creature, as a point area seals them per caught creature
 * and a list of chosen creatures prepares them for each one named.
 */
export function prepareCasterActionOnTarget(
  input: Pick<
    AreaPlanBase,
    'state' | 'system' | 'actors' | 'activeEffectsByActorId' | 'capture'
  > & {
    command: Pick<ResolveEncounterActionInputDto, 'actionId' | 'acceptedWieldConflict' | 'target'>
  },
  action: {
    caster: EncounterRunActorState
    target: EncounterRunActorState
    movementTargets: Awaited<ReturnType<typeof prepareAreaScene>>['movementTargets']
    sceneContext: Parameters<typeof prepareEncounterActionMechanics>[0]['sceneContext']
    /** Where an area starts: its saves are made against what each creature sees of this point. */
    origin?: { point: ScenePoint; sceneId: string; sceneVersion: number }
  }
) {
  const { origin, sceneContext } = action
  return prepareEncounterActionMechanics({
    state: input.state,
    actor: action.caster,
    target: action.target,
    actors: input.actors,
    actionId: input.command.actionId,
    choiceOptionId: castChoiceOptionId(input.command.target),
    wieldConflictAcceptance: {
      kind: 'PROMPTED',
      accepted: input.command.acceptedWieldConflict
    },
    overridable: true,
    movementTargets: action.movementTargets,
    sceneContext,
    loadAttackPerception:
      origin && sceneContext
        ? ({ targetFacts }) =>
            readNativeLivePointPerception({
              state: input.state,
              system: input.system,
              observer: targetFacts,
              point: origin.point,
              sceneContext: {
                sceneId: origin.sceneId,
                sceneVersion: origin.sceneVersion,
                grid: sceneContext.grid
              },
              capture: input.capture
            })
        : undefined,
    loadSource: async (source) => resolveEncounterActionSource({ ...source, system: input.system }),
    loadRelationshipFacts: nativeLiveRelationshipFacts({
      activeEffectsByActorId: input.activeEffectsByActorId
    })
  }).catch(refuseStaleCharacterAction)
}

/** The counter window of a multi-creature cast, held over the caster's lead preparation of the action. */
function reachCastPause(
  input: ReachPlanInput,
  cast: {
    reach: Pick<AreaReach, 'scene' | 'movementTargets'>
    lead: AreaPrepared
    chosenActorIds: readonly string[] | null
    occurrenceId: string
    occurredAt: string
    answer: NativeCastReactionAnswer | null
    failedCounters: readonly EncounterFailedCounterDto[]
  }
) {
  const { scene } = cast.reach
  return createNativeCastPause({
    runtime: input.runtime,
    random: input.random,
    state: input.state,
    system: input.system,
    actors: input.actors,
    activeEffectsByActorId: input.activeEffectsByActorId,
    loadTarget: input.loadTarget,
    capture: input.capture,
    requireAutoRoll: input.requireAutoRoll,
    command: input.command,
    prepared: cast.lead,
    movementTargets: cast.reach.movementTargets,
    reactionSources: {
      loadSource: async (source) =>
        resolveEncounterActionSource({ ...source, system: input.system }),
      loadRelationshipFacts: nativeLiveRelationshipFacts({
        activeEffectsByActorId: input.activeEffectsByActorId
      })
    },
    // Range is read from the Scene, so a cast aimed at none offers no reaction.
    readScene: scene ? async () => scene : null,
    chosenActorIds: cast.chosenActorIds,
    occurrenceId: cast.occurrenceId,
    occurredAt: cast.occurredAt,
    userId: input.initial.expectedUserId,
    answer: cast.answer,
    resumed: input.castResume !== undefined,
    failedCounters: cast.failedCounters
  })
}

/** What a multi-creature cast carries out of its counter window into its saves or its commit. */
export type ReachCastWindow = {
  occurrenceId: string
  occurrenceVersion: number
  occurredAt: string
  /** The answer that resumed the cast; null when it opened just now. */
  response: ResolveRuleOccurrenceInputDto | null
  initiatorUserId: string
  failedCounters: readonly EncounterFailedCounterDto[]
  pause: ReturnType<typeof reachCastPause>
}

/**
 * Opens a multi-creature cast to the counters of other Characters before any creature is touched
 * (D127). The cast is either ended or held for a counter, which is the plan to return, or goes on under
 * the occurrence it runs under, with the counters that failed against it so far.
 */
export async function openReachCastWindow(
  input: ReachPlanInput,
  cast: {
    reach: AreaReach
    lead: AreaPrepared
    /** The creatures a chosen-list cast names, who may answer being chosen; null for any other shape. */
    chosenActorIds: readonly string[] | null
    evaluation: Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>
    ruleOverrides: ReturnType<typeof reachRuleOverrides>
  }
) {
  const { castResume } = input
  const { lead, ruleOverrides } = cast
  const occurrenceId = castResume ? castResume.response.occurrenceId : crypto.randomUUID()
  const occurrenceVersion = castResume ? castResume.response.expectedOccurrenceVersion + 1 : 0
  const occurredAt = new Date().toISOString()
  const initiatorUserId = castResume?.initiatorUserId ?? input.initial.expectedUserId
  const actionEconomy = cast.evaluation.economy?.consumption ?? null
  const currentnessChecksum = encounterActionCurrentnessChecksum({
    prepared: lead,
    actionEconomy,
    attackAction: cast.evaluation.attackAction,
    maintenance: null,
    sceneContext: null
  })
  if (castResume && castResume.currentnessChecksum !== currentnessChecksum)
    throw new Error('The pending action source or target changed.')
  const pause = reachCastPause(input, {
    reach: cast.reach,
    lead,
    chosenActorIds: cast.chosenActorIds,
    occurrenceId,
    occurredAt,
    answer: castResume?.answer ?? null,
    failedCounters: castResume?.failedCounters ?? []
  })
  const advanced = await pause.advance({ actionEconomy, ruleOverrides, occurrenceVersion })
  if (advanced.kind !== 'NONE')
    return {
      kind: 'PLAN' as const,
      plan: {
        ...advanced,
        command: input.command,
        response: castResume?.response ?? null,
        initiatorUserId,
        fingerprint: input.fingerprint,
        occurrenceId,
        occurrenceVersion,
        occurredAt,
        prepared: lead,
        ruleOverrides,
        currentnessChecksum
      }
    }
  return {
    kind: 'OPEN' as const,
    window: {
      occurrenceId,
      occurrenceVersion,
      occurredAt,
      response: castResume?.response ?? null,
      initiatorUserId,
      failedCounters: advanced.failedCounters,
      pause
    } satisfies ReachCastWindow
  }
}

/** The creatures a rolled hit-point pool covers, lowest current hit points first (Sleep). */
function hitPointPoolCovered<Caught extends { actor: EncounterRunActorState }>(
  caught: readonly Caught[],
  pool: number,
  targeting: CompiledActionTargetPolicy['targeting'],
  movementTargets: ReadonlyMap<
    string,
    { state: { current: number; conditions: readonly string[] } }
  >
) {
  const covered = new Set(
    selectHitPointPoolTargets(
      pool,
      caught.map(({ actor }) => ({
        actorId: actor.id,
        currentHitPoints: movementTargets.get(actor.id)!.state.current,
        creatureTypeId: snapshotCreatureTypeId(actor),
        conditionIds: movementTargets.get(actor.id)!.state.conditions
      })),
      targeting
    )
  )
  return caught.filter(({ actor }) => covered.has(actor.id))
}

/**
 * Plans a point-area action up to its pending saves. Whom the area catches is decided here, from the
 * Scene the caster saw (fenced by its version); every caught creature, allies and the caster
 * included, gets its own sealed save, and none is rolled until its roller answers.
 */
export async function planNativeLiveEncounterAreaAction(input: AreaPlanInput) {
  const { command, state, actors, capture } = input
  const base = await prepareAreaScene(input)
  const { caster, casterFacts, movementTargets, scene, area, targetPolicy } = base

  // A zone is entered later, by movement; placing it puts nobody through its entry save, only
  // through the save its cast authors for when it appears.
  const caughtActorIds =
    base.placement && !base.placement.appearSave
      ? []
      : catchEncounterAreaActorIds({
          origin: area.origin,
          shape: area.shape,
          casterActorId: caster.id,
          tokens: scene.tokens.map((token) => ({ ...token, id: token.tokenId })),
          fromCasterSpace: command.target.kind === 'CASTER_CENTERED'
        })
  const caughtInArea = caughtActorIds.map((actorId) => {
    const actor = actors.find((candidate) => candidate.id === actorId)
    const token = scene.tokens.find((candidate) => candidate.actorId === actorId)
    if (!actor || !token) throw new Error('Encounter rules input binding mismatch.')
    return { actor, token }
  })
  for (const { actor } of caughtInArea)
    if (!movementTargets.has(actor.id)) movementTargets.set(actor.id, await input.loadTarget(actor))
  // An area with a hit-point pool affects the creatures the pool covers, lowest hit points first.
  const contents =
    targetPolicy.targeting?.selectionKind === 'AREA_CONTENTS' ? targetPolicy.targeting : null
  const caught = contents?.hitPointPool
    ? hitPointPoolCovered(
        caughtInArea,
        evaluateRollExpression(parseRollExpression(contents.hitPointPool.diceConfig), {
          nextInt: input.random ?? nextRollInt
        }).evidence.total,
        contents,
        movementTargets
      )
    : caughtInArea

  // Whom the caster perceives is decided once, as the area opens, and sealed with each creature's
  // save: a later change of sight or lighting does not change what the caster is told (D100).
  const perceivedByCaster = new Set<string>()
  for (const { actor } of caught) {
    const target = movementTargets.get(actor.id)
    if (
      actor.id === caster.id ||
      (target &&
        (
          await readNativeLiveAttackPerception({
            state,
            system: input.system,
            attacker: casterFacts,
            target,
            roller: 'ATTACKER',
            sceneContext: {
              sceneId: scene.sceneId,
              sceneVersion: scene.sceneVersion,
              grid: scene.grid
            },
            capture
          })
        ).actual.attackerSeesTarget === 'SEES')
    )
      perceivedByCaster.add(actor.id)
  }

  const reached = []
  for (const { actor, token } of caught)
    reached.push({
      actor,
      perceivedByCaster: perceivedByCaster.has(actor.id),
      ...(await prepareAreaTarget({ ...input, base, actor, token }))
    })
  // An area that catches nobody still spends the action: its checks run against the caster's own
  // preparation of it.
  // An area that keeps no creature is checked and spent against the caster's own preparation.
  const lead =
    reached[0] ??
    (await prepareAreaTarget({
      ...input,
      base,
      actor: base.caster,
      token: base.scene?.sourceToken ?? null
    }))
  refuseActionOutsideItsWindow(lead.prepared)
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')

  const evaluation = await evaluateNativeLiveActionEconomy({
    prepared: lead.prepared,
    state,
    actionId: command.actionId,
    sourceTarget: casterFacts,
    targetIds: caughtActorIds,
    capture
  })
  const ruleOverrides = reachRuleOverrides({
    command,
    lead: lead.prepared,
    evaluation,
    areaWarnings: area.warnings,
    targets: reached,
    movementTargets
  })
  const opened = await openReachCastWindow(input, {
    reach: base,
    lead: lead.prepared,
    chosenActorIds: null,
    evaluation,
    ruleOverrides
  })
  if (opened.kind === 'PLAN') return opened.plan
  // An area that asks no save commits at once, as one cast on the creatures it reached.
  if (contents?.hitPointPool && lead.prepared.plan.kind === 'SINGLE_GRAPH') {
    const { window } = opened
    const settled = await executeEncounterActorsAction({
      runtime: input.runtime,
      random: input.random,
      adapter: lead.prepared.adapter,
      plan: lead.prepared.plan,
      occurrenceId: window.occurrenceId,
      rollsPerTarget: false,
      targets: reached.map(({ actor, prepared }) => ({
        actorId: actor.id,
        binding: prepared.binding
      }))
    })
    return completeAreaCommit({
      input,
      command,
      caster,
      occurredAt: window.occurredAt,
      failedCounters: await window.pause.planFailedCounters(window.failedCounters),
      movementTargets,
      kept: reached.map(({ actor, prepared }) => ({ actor, target: { prepared } })),
      lead: lead.prepared,
      formCreature: null,
      ruleOverrides,
      actionEconomy: evaluation.economy?.consumption ?? null,
      attackAction: evaluation.attackAction,
      settled,
      rollsPerTarget: false,
      tests: [],
      audits: new Map(),
      areaOccurrenceId: window.occurrenceId,
      areaSnapshot: null,
      caughtChecksum: encounterChosenActorsChecksum(caught.map(({ actor }) => actor.id)),
      removedActorIds: [],
      placement: null,
      occurrenceVersion: window.occurrenceVersion,
      response: window.response,
      removal: null
    })
  }
  return sealReachSaves(input, {
    reach: base,
    lead: lead.prepared,
    targets: reached,
    evaluation,
    ruleOverrides,
    window: opened.window
  })
}

/** One creature a multi-creature action reaches, prepared as the action opened. */
export type ReachTarget = Awaited<ReturnType<typeof prepareAreaTarget>> & {
  actor: EncounterRunActorState
  /** Whether the caster perceived the creature as the action opened (D100). */
  perceivedByCaster: boolean
}

/**
 * Seals the save of every creature a multi-creature action reaches, one pending request each, then
 * either settles the action (every roller auto-rolled) or leaves it pending on its rollers. None is
 * rolled until its roller answers, except for a roller who auto-rolls.
 */
export async function sealReachSaves(
  input: ReachPlanInput,
  sealed: {
    reach: AreaReach
    lead: AreaPrepared
    targets: readonly ReachTarget[]
    evaluation: Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>
    ruleOverrides: ReturnType<typeof reachRuleOverrides>
    window: ReachCastWindow
  }
) {
  const { command, state, actors, capture } = input
  const { reach, lead, targets: reached, evaluation, ruleOverrides, window } = sealed
  const { economy, attackAction } = evaluation
  const actionEconomy = economy?.consumption ?? null
  const maintenance = await prepareNativeLiveActionMaintenance({
    prepared: lead,
    activeEffectsByActorId: input.activeEffectsByActorId,
    capture,
    loadCarriedHolder: async (actor) =>
      reach.movementTargets.get(actor.id) ?? input.loadTarget(actor)
  })

  const { occurrenceId } = window
  const entries = encounterChosenActorEntries(
    occurrenceId,
    reached.map(({ prepared }) => prepared.target.id)
  )
  const tests = await prepareEncounterAreaTests({
    runtime: input.runtime,
    random: input.random,
    adapter: lead.adapter,
    plan: lead.plan,
    occurrenceId,
    targets: reached.map(({ prepared }, index) => ({
      actorId: prepared.target.id,
      occurrenceId: entries[index]!.occurrenceId,
      binding: prepared.binding,
      attackSight: prepared.attackSight,
      autoRoll: { SOURCE: false, TARGET: false },
      discoverLegendaryResistance: discoverNativeLegendaryResistance(input, prepared)
    }))
  })
  const commandJson = JSON.stringify(command)
  const { initiatorUserId } = window
  const targets = reached.map(({ prepared, token, sceneContext, perceivedByCaster }, index) => {
    const test = tests.find((candidate) => candidate.occurrenceId === entries[index]!.occurrenceId)
    if (test?.kind !== 'PENDING') throw new Error('An area roll must wait for its roller.')
    return {
      actorId: prepared.target.id,
      perceivedByCaster,
      token: token
        ? {
            tokenId: token.tokenId,
            position: token.position,
            width: token.width,
            height: token.height,
            rotationDegrees: token.rotationDegrees
          }
        : null,
      snapshot: buildEncounterActionPendingSnapshot({
        execution: test.pending,
        optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
        commandJson,
        commandFingerprint: input.fingerprint,
        initiatorUserId,
        sourceActorId: reach.caster.id,
        targetActorId: prepared.target.id,
        currentnessChecksum: encounterActionCurrentnessChecksum({
          prepared,
          actionEconomy,
          attackAction,
          maintenance,
          sceneContext
        })
      })
    }
  })
  let snapshot = buildEncounterAreaPendingSnapshot({
    occurrenceId,
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
    commandJson,
    commandFingerprint: input.fingerprint,
    initiatorUserId,
    casterActorId: reach.caster.id,
    placesZone: reach.placement !== null,
    zoneAppearSave: reach.placement?.appearSave ?? false,
    scene: reach.scene && { sceneId: reach.scene.sceneId, sceneVersion: reach.scene.sceneVersion },
    area: reach.area && { origin: reach.area.origin, shape: reach.area.shape },
    ...(window.failedCounters.length > 0 ? { failedCounters: [...window.failedCounters] } : {}),
    targets
  })
  // An entry whose roller auto-rolls has its roll made now, so an auto-rolled failed save opens its
  // Legendary Resistance choice. It is kept as the dice it rolled, which replay without rolling again.
  for (const [index, target] of targets.entries()) {
    if (
      target.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
      !input.requireAutoRoll(target.snapshot.applicationContext.rollerActorId)
    )
      continue
    const entry = reached[index]!
    const requestId = target.snapshot.request.requestId
    const tested = await replayAreaTargetSave(
      input,
      { actor: entry.actor, target: entry },
      target,
      occurrenceId,
      { kind: 'AUTO_ROLL', requestId }
    )
    const rolled: EncounterEvidenceAnswer = {
      kind: 'ENTER_DICE',
      requestId,
      rawFaces: tested.boundary.d20.rawFaces,
      rollMode: tested.boundary.d20.rollMode
    }
    snapshot = markEncounterAreaSaveTested(
      snapshot,
      requestId,
      JSON.stringify(rolled),
      offerEncounterAreaLegendaryResistance({
        test: tested,
        targetStateChecksum: checksumRuleDocument(entry.prepared.target)
      })
    )
  }
  if (encounterAreaSettled(snapshot))
    return planNativeLiveEncounterAreaCommit({
      ...input,
      response: window.response,
      areaSnapshot: snapshot
    })
  return {
    kind: 'AREA_PENDING' as const,
    command,
    response: window.response,
    snapshot,
    prepared: { actors },
    ruleOverrides,
    fingerprint: input.fingerprint,
    initiatorUserId,
    occurrenceId
  }
}

/**
 * Plans one creature's answer to its save in a pending area. The answer is checked against that
 * creature's own sealed facts and kept with its save; no other creature is touched, and nothing is
 * rolled for damage until the area settles.
 */
export async function planNativeLiveEncounterAreaAnswer(
  input: ReachPlanInput & {
    response: ResolveRuleOccurrenceInputDto
    resolution: EncounterEvidenceAnswer
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
  }
) {
  const { command, actors, areaSnapshot, resolution } = input
  const context = areaSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_AREA_ACTION')
    throw new Error('The pending area action is unavailable.')
  const answered = context.targets.find(
    (target) => target.snapshot.request.requestId === resolution.requestId
  )
  if (
    !answered ||
    answered.testedJson !== undefined ||
    answered.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
    areaSnapshot.occurrenceId !== input.response.occurrenceId ||
    answered.snapshot.occurrenceId !==
      encounterChosenActorEntries(
        areaSnapshot.occurrenceId,
        context.targets.map(({ actorId }) => actorId)
      )[context.targets.indexOf(answered)]?.occurrenceId ||
    context.commandFingerprint !== input.fingerprint ||
    command.optionalCombatIntent != null
  )
    throw new Error('The pending action evidence is invalid.')
  const revalidated = await revalidateAreaTarget(input, context, answered)
  const tested = await replayAreaTargetSave(
    input,
    revalidated,
    answered,
    areaSnapshot.occurrenceId,
    resolution
  )
  const offer = offerEncounterAreaLegendaryResistance({
    test: tested,
    targetStateChecksum: checksumRuleDocument(revalidated.target.prepared.target)
  })
  const snapshot = markEncounterAreaSaveTested(
    areaSnapshot,
    resolution.requestId,
    JSON.stringify(resolution),
    offer
  )
  if (encounterAreaSettled(snapshot))
    return planNativeLiveEncounterAreaCommit({
      ...input,
      areaSnapshot: snapshot
    })
  return {
    kind: 'AREA_PENDING' as const,
    command,
    response: input.response,
    snapshot,
    prepared: { actors },
    fingerprint: input.fingerprint,
    initiatorUserId: context.initiatorUserId,
    occurrenceId: areaSnapshot.occurrenceId
  }
}

/**
 * Plans one creature's Legendary Resistance decision on its failed area save. Its save is replayed
 * from the answer kept with it, so the decision is checked against the save, the creature's facts and
 * its pool as they are now; no other creature is touched. The charge it proposes is spent when the
 * area commits, not here.
 */
export async function planNativeLiveEncounterAreaLegendaryResistance(
  input: ReachPlanInput & {
    response: ResolveRuleOccurrenceInputDto
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
    decision: Extract<
      ResolveRuleOccurrenceInputDto['resolution'],
      { kind: 'AREA_LEGENDARY_RESISTANCE' }
    >
  }
) {
  const { command, actors, areaSnapshot, decision } = input
  const selection: EncounterLegendaryResistanceSelection =
    decision.decision.kind === 'USE'
      ? { kind: 'OPTION', optionId: decision.decision.optionId }
      : { kind: 'DECLINE' }
  const context = areaSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_AREA_ACTION')
    throw new Error('The pending area action is unavailable.')
  const decided = context.targets.find((target) => target.actorId === decision.actorId)
  if (
    !decided?.legendaryResistance ||
    decided.legendaryResistance.decision ||
    decided.testedJson === undefined ||
    decided.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
    areaSnapshot.occurrenceId !== input.response.occurrenceId ||
    context.commandFingerprint !== input.fingerprint ||
    command.optionalCombatIntent != null
  )
    throw new Error('The pending Legendary Resistance evidence is invalid.')
  const revalidated = await revalidateAreaTarget(input, context, decided)
  const resolution: EncounterEvidenceAnswer = JSON.parse(decided.testedJson)
  const tested = await replayAreaTargetSave(
    input,
    revalidated,
    decided,
    areaSnapshot.occurrenceId,
    resolution
  )
  const { prepared } = revalidated.target
  const candidate = await discoverNativeLegendaryResistance(input, prepared)()
  if (!candidate) throw new Error('Legendary Resistance evidence is stale.')
  const resource = findEncounterFeatureResource(
    prepared.actorRules,
    candidate.targetActorId,
    candidate.ownerFeatureId
  )
  if (!resource) throw new Error('The Legendary Resistance resource is unavailable.')
  const { legendaryResistance, chargeProposal } = await decideEncounterAreaLegendaryResistance({
    runtime: input.runtime,
    areaOccurrenceId: areaSnapshot.occurrenceId,
    test: tested,
    offer: decided.legendaryResistance,
    candidate,
    targetStateChecksum: checksumRuleDocument(prepared.target),
    selection,
    currentFeatureResource: resource
  })
  const snapshot = markEncounterAreaLegendaryResistanceDecided(
    areaSnapshot,
    decision.actorId,
    legendaryResistance
  )
  if (encounterAreaSettled(snapshot))
    return planNativeLiveEncounterAreaCommit({
      ...input,
      areaSnapshot: snapshot
    })
  return {
    kind: 'AREA_PENDING' as const,
    command,
    response: input.response,
    snapshot,
    chargeProposal,
    prepared: { actors },
    fingerprint: input.fingerprint,
    initiatorUserId: context.initiatorUserId,
    occurrenceId: areaSnapshot.occurrenceId
  }
}

type AreaContext = Extract<
  ServerAggregateChoicePendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_AREA_ACTION' }
>
type AreaTargetRecord = AreaContext['targets'][number]

/** The creature's Legendary Resistance on its current pool, looked up only once its save has failed. */
export function discoverNativeLegendaryResistance(
  input: Pick<AreaPlanInput, 'state' | 'capture'>,
  prepared: Pick<Awaited<ReturnType<typeof prepareAreaTarget>>['prepared'], 'target' | 'actorRules'>
) {
  return async () =>
    prepared.target.kind === 'CREATURE'
      ? discoverEncounterLegendaryResistanceCandidate({
          encounter: input.state,
          targetActor: prepared.target,
          actorRules: prepared.actorRules,
          definitions: {
            requireCurrent: async (definitionId) => {
              const response = await input.capture({
                kind: 'DEFINITION',
                definitionId
              })
              if (response.kind !== 'DEFINITION' || !response.definition)
                throw new Error('Legendary Resistance definition is unavailable.')
              return response.definition
            }
          }
        })
      : null
}

/**
 * Prepares a sealed creature again against the Scene and its facts as they are now, and refuses it if
 * the area, the creature's source or target, or the action's economy changed since the area opened.
 */
async function revalidateAreaTarget(
  input: ReachPlanInput,
  context: AreaContext,
  sealed: AreaTargetRecord,
  reach?: AreaReach
) {
  const { command, state, actors, capture } = input
  const base = reach ?? (await prepareReach(input))
  if (
    base.scene?.sceneVersion !== context.scene?.sceneVersion ||
    checksumCanonicalJson(base.area?.shape ?? null) !==
      checksumCanonicalJson(context.area?.shape ?? null)
  )
    throw new Error('The pending area changed.')
  const actor = actors.find((candidate) => candidate.id === sealed.actorId)
  const token = base.scene?.tokens.find((candidate) => candidate.actorId === sealed.actorId) ?? null
  if (!actor || sealed.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION')
    throw new Error('Encounter rules input binding mismatch.')
  // A creature that had a token on the Scene must still have one (and one that had none, none).
  if ((token === null) !== (sealed.token === null)) throw new Error('The pending area changed.')
  if (!base.movementTargets.has(actor.id))
    base.movementTargets.set(actor.id, await input.loadTarget(actor))
  const target = await prepareAreaTarget({
    ...input,
    base,
    actor,
    token
  })
  refuseActionOutsideItsWindow(target.prepared)
  const evaluation = await evaluateNativeLiveActionEconomy({
    prepared: target.prepared,
    state,
    actionId: command.actionId,
    sourceTarget: base.casterFacts,
    // The creatures the area first caught, as its sealed saves were prepared with.
    targetIds: [...context.targets.map(({ actorId }) => actorId), ...context.removedActorIds],
    capture
  })
  const { economy, attackAction } = evaluation
  const maintenance = await prepareNativeLiveActionMaintenance({
    prepared: target.prepared,
    activeEffectsByActorId: input.activeEffectsByActorId,
    capture,
    loadCarriedHolder: async (carrier) =>
      base.movementTargets.get(carrier.id) ?? input.loadTarget(carrier)
  })
  if (
    sealed.snapshot.applicationContext.currentnessChecksum !==
    encounterActionCurrentnessChecksum({
      prepared: target.prepared,
      actionEconomy: economy?.consumption ?? null,
      attackAction,
      maintenance,
      sceneContext: target.sceneContext
    })
  )
    throw new Error('The pending action source or target changed.')
  return { actor, target, evaluation }
}

/** Runs one entry's sealed roll with its answer: a creature's own save, or the caster's roll for a ray. */
async function replayAreaTargetSave(
  input: ReachPlanInput,
  { actor, target }: Pick<Awaited<ReturnType<typeof revalidateAreaTarget>>, 'actor' | 'target'>,
  sealed: AreaTargetRecord,
  areaOccurrenceId: string,
  resolution: EncounterEvidenceAnswer
) {
  const [tested] = await answerEncounterAreaTest({
    runtime: input.runtime,
    random: input.random,
    adapter: target.prepared.adapter,
    plan: target.prepared.plan,
    occurrenceId: areaOccurrenceId,
    target: {
      actorId: actor.id,
      occurrenceId: sealed.snapshot.occurrenceId,
      binding: target.prepared.binding,
      attackSight: target.prepared.attackSight,
      autoRoll: { SOURCE: false, TARGET: false },
      discoverLegendaryResistance: discoverNativeLegendaryResistance(input, target.prepared)
    },
    tests: [
      {
        actorId: actor.id,
        occurrenceId: sealed.snapshot.occurrenceId,
        kind: 'PENDING',
        pending: {
          ...restoreEncounterActionPending(sealed.snapshot),
          roller: 'TARGET'
        }
      }
    ],
    resolution
  })
  if (tested?.kind !== 'TESTED') throw new Error('An area save must settle with its answer.')
  return tested
}

/** The sealed pending contract the room persists for a point-area action: every caught creature's save. */
export function buildNativeLiveEncounterAreaActionPendingInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Pick<
    Extract<
      | Awaited<ReturnType<typeof planNativeLiveEncounterAreaAction>>
      | Awaited<ReturnType<typeof planNativeLiveEncounterAreaAnswer>>
      | Awaited<ReturnType<typeof planNativeLiveEncounterAreaLegendaryResistance>>,
      { kind: 'AREA_PENDING' }
    >,
    'command' | 'response' | 'snapshot'
  > & {
    dependencies: readonly { request: LiveSessionEncounterRulesRequest }[]
    revisions: LiveSessionRulesRevisions
  }
) {
  return liveSessionEncounterActionPendingInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    revisions: plan.revisions,
    maintenanceOwners: plan.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER' ? [request] : []
    ),
    snapshot: plan.snapshot
  })
}

type AreaPrepared = Awaited<ReturnType<typeof prepareAreaTarget>>['prepared']

export function leadActiveEffectPlan(prepared: AreaPrepared) {
  return encounterActiveEffectPlan(
    prepared,
    prepared.plan.kind === 'SINGLE_GRAPH' ? prepared.plan.published : prepared.plan.test.published
  )
}

const formRefusal = (message: string) =>
  new LiveSessionDomainRejectionError(422, {
    code: 'DOMAIN_REJECTED',
    reason: 'TARGET_UNAVAILABLE',
    message
  })

const characterLevelOf = (target: MovementTargets | undefined) =>
  target?.characterFacts ? characterTotalLevel(target.characterFacts) : null

/**
 * The Creature the caster's chosen form swaps the targets into (D130), or null for an action that
 * holds no form. The form is the caster's one choice for the whole cast: one of the action's fixed
 * forms (capped by its own targets), or a Creature that meets the action's form filter, checked
 * here against the System creature corpus. A save that pends re-reads it from the sealed command.
 */
export async function readChosenFormCreature(
  input: AreaPlanBase & { command: ReachCommand },
  lead: AreaPrepared,
  targets: readonly EncounterRunActorState[],
  movementTargets: ReadonlyMap<string, MovementTargets>
) {
  const chosen = input.command.target.kind === 'ACTORS' ? input.command.target : null
  const formId = chosen?.formId
  const creatureId = chosen?.creatureId
  const contribution = leadActiveEffectPlan(lead)?.creatureFormContribution
  if (!contribution) {
    if (formId !== undefined || creatureId !== undefined)
      throw formRefusal('This action takes no creature form.')
    return null
  }
  const form = contribution.forms.find((candidate) => candidate.id === formId)
  const sourceId = form?.creatureId ?? creatureId
  if (sourceId === undefined || (formId !== undefined && creatureId !== undefined))
    throw formRefusal('This action needs one of its creature forms.')
  if (creatureId !== undefined && !contribution.filter)
    throw formRefusal('This action takes only its own creature forms.')
  if (form && targets.length > form.maxTargets)
    throw formRefusal(`That form takes at most ${form.maxTargets} creatures.`)
  if (targets.some((actor) => actor.form !== null))
    throw formRefusal('A chosen creature cannot take a creature form.')
  if (!input.readFormCreature) throw new Error('The creature form cannot be read.')
  const creature = await input.readFormCreature(input.state.gameSystemId, sourceId)
  if (contribution.filter && creatureId !== undefined)
    for (const actor of targets) {
      const refused = creatureFormFilterRefusal({
        filter: contribution.filter,
        form: creature,
        target: {
          snapshot: actor.kind === 'CHARACTER' ? null : actor.snapshot,
          level: characterLevelOf(movementTargets.get(actor.id))
        },
        system: input.system
      })
      if (refused) throw formRefusal(refused)
    }
  return creature
}

/**
 * The warnings a multi-creature action raises, refused unless the caster acknowledged them. A point
 * area catches everyone in it, so no per-target rule applies; a list of chosen creatures checks each
 * creature it names.
 */
export function reachRuleOverrides(input: {
  command: Pick<ReachCommand, 'target' | 'acknowledgedWarnings'>
  lead: AreaPrepared
  evaluation: Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>
  areaWarnings: readonly EncounterRuleWarningDto[]
  targets: readonly Pick<ReachTarget, 'prepared' | 'sceneContext'>[]
  movementTargets: ReadonlyMap<string, MovementTargets>
}): EncounterRuleWarningDto[] {
  const { activationCode, economy, suppressed } = input.evaluation
  const caster = input.movementTargets.get(input.lead.actor.id)
  if (!caster) throw new Error('Encounter rules input binding mismatch.')
  const shared = {
    preparedWarnings: [
      ...input.lead.ruleWarnings,
      ...encounterFleeActionWarnings({
        sourceActorIds: encounterConditionFleeSources(caster),
        activationCode,
        dash: false
      }),
      ...(suppressed ? [encounterActionSuppressedWarning(activationCode)] : [])
    ],
    areaWarnings: input.areaWarnings,
    actionEconomy: economy,
    activationCode,
    acknowledged: input.command.acknowledgedWarnings
  }
  const deadCharacterIds = deadCharacterIdsOfTargets(input.movementTargets.values())
  const ruleWarnings =
    input.command.target.kind === 'ACTORS'
      ? evaluateEncounterActorsRuleWarnings({
          ...shared,
          targets: input.targets.map(({ prepared, sceneContext }) => ({
            target: {
              actor: prepared.actor,
              target: prepared.target,
              targetPolicy: prepared.targetPolicy,
              makesAttackRoll: prepared.makesAttackRoll,
              sceneContext
            },
            targetDefeated: isEncounterActorDefeated(prepared.target, deadCharacterIds),
            targetCreatureTypeId: snapshotCreatureTypeId(prepared.target),
            targetIntelligence: snapshotAbilityScore(prepared.target, 'INTELLIGENCE')
          })),
          linkIntelligenceFloor:
            leadActiveEffectPlan(input.lead)?.actorLinkContribution
              ?.excludesIntelligenceAtOrBelow ?? null
        })
      : evaluateEncounterAreaRuleWarnings(shared)
  if (ruleWarnings.kind === 'UNSUPPORTED_TARGET')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'The selected action does not permit this target.'
    })
  if (ruleWarnings.kind === 'UNACKNOWLEDGED')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: RULE_WARNINGS_MESSAGE,
      warnings: ruleWarnings.warnings
    })
  return ruleWarnings.overrides
}

/**
 * The caster's lead for an area that keeps no creature: the action prepared on the caster, checked
 * and measured against the economy as an area that caught creatures would have been.
 */
async function prepareAreaCasterLead(
  input: ReachPlanInput,
  base: AreaReach,
  removedActorIds: readonly string[]
) {
  const target = await prepareAreaTarget({
    ...input,
    base,
    actor: base.caster,
    token: base.scene?.sourceToken ?? null
  })
  refuseActionOutsideItsWindow(target.prepared)
  return {
    target,
    evaluation: await evaluateNativeLiveActionEconomy({
      prepared: target.prepared,
      state: input.state,
      actionId: input.command.actionId,
      sourceTarget: base.casterFacts,
      targetIds: [...removedActorIds],
      capture: input.capture
    })
  }
}

/**
 * Plans the area the GM's removal of the last creature it waited on settles: the same commit the
 * last answer would have made, over the area as the removal leaves it.
 */
export async function planNativeLiveEncounterAreaRemoval(
  input: ReachPlanInput & {
    removal: RemoveAreaTargetInputDto
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
  }
) {
  const removed = removeEncounterAreaTargetFromSnapshot(
    input.areaSnapshot,
    input.removal.actorId.toLowerCase()
  )
  if (removed.kind !== 'REMOVED' || !encounterAreaSettled(removed.snapshot))
    throw new Error('The area still waits on a creature.')
  return planNativeLiveEncounterAreaCommit({
    ...input,
    response: null,
    areaSnapshot: removed.snapshot
  })
}

/**
 * Plans the commit of a settled area: every kept creature's save is replayed from the answer kept
 * with it, damage is rolled once and frozen across them, and each creature's outcome becomes its
 * own receipt under one root that holds the caster's single spend.
 */
export async function planNativeLiveEncounterAreaCommit(
  input: ReachPlanInput & {
    response: ResolveRuleOccurrenceInputDto | null
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
    /** The GM removal that left nothing to wait on, when it, not an answer, settles the area. */
    removal?: RemoveAreaTargetInputDto
  }
) {
  const { command, areaSnapshot } = input
  const context = areaSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_AREA_ACTION')
    throw new Error('The pending area action is unavailable.')
  const areaOccurrenceId = areaSnapshot.occurrenceId
  const base = await prepareReach(input)
  const { caster } = base
  const kept = []
  for (const sealed of context.targets)
    kept.push({
      sealed,
      ...(await revalidateAreaTarget(input, context, sealed, base))
    })
  // An area that keeps no creature (it caught nobody, or the GM removed everyone it caught) commits
  // the caster's spend alone, against the caster's own preparation of the action.
  const first = kept[0] ?? (await prepareAreaCasterLead(input, base, context.removedActorIds))
  const lead = first.target.prepared
  const formCreature = await readChosenFormCreature(
    input,
    lead,
    kept.map(({ target }) => target.prepared.target),
    base.movementTargets
  )
  const ruleOverrides = reachRuleOverrides({
    command,
    lead,
    evaluation: first.evaluation,
    areaWarnings: base.area?.warnings ?? [],
    targets: kept.map(({ target }) => target),
    movementTargets: base.movementTargets
  })
  const { economy, attackAction } = first.evaluation
  const actionEconomy = economy?.consumption ?? null

  // Each ray of an attack list rolls its own damage; a point area or a save list shares one roll.
  const rollsPerTarget = lead.makesAttackRoll
  const tests = []
  for (const entry of kept) {
    if (entry.sealed.testedJson === undefined) throw new Error('The area roll is unanswered.')
    const resolution: EncounterEvidenceAnswer = JSON.parse(entry.sealed.testedJson)
    tests.push(await replayAreaTargetSave(input, entry, entry.sealed, areaOccurrenceId, resolution))
  }
  const audits = encounterAreaLegendaryResistanceAudits(
    new Map(
      context.targets.flatMap(({ actorId, legendaryResistance }) =>
        legendaryResistance ? [[actorId, legendaryResistance] as const] : []
      )
    )
  )
  const settled = await settleEncounterAreaAction({
    runtime: input.runtime,
    random: input.random,
    adapter: lead.adapter,
    plan: lead.plan,
    occurrenceId: areaOccurrenceId,
    targets: kept.map(({ target, sealed }) => ({
      actorId: target.prepared.target.id,
      occurrenceId: sealed.snapshot.occurrenceId,
      binding: target.prepared.binding,
      attackSight: target.prepared.attackSight,
      autoRoll: { SOURCE: false, TARGET: false },
      discoverLegendaryResistance: discoverNativeLegendaryResistance(input, target.prepared)
    })),
    tests,
    legendaryResistance: audits,
    rollsPerTarget
  })

  const resumed = input.response ?? input.removal
  const occurredAt = new Date().toISOString()
  const sealedFailedCounters = context.failedCounters ?? []
  const plan = await completeAreaCommit({
    input,
    command,
    caster,
    occurredAt,
    failedCounters: await reachCastPause(input, {
      reach: base,
      lead,
      chosenActorIds: null,
      occurrenceId: areaOccurrenceId,
      occurredAt,
      answer: null,
      failedCounters: sealedFailedCounters
    }).planFailedCounters(sealedFailedCounters),
    movementTargets: base.movementTargets,
    kept,
    lead,
    ruleOverrides,
    formCreature,
    actionEconomy,
    attackAction,
    settled,
    rollsPerTarget,
    tests,
    audits,
    areaOccurrenceId,
    areaSnapshot,
    caughtChecksum: context.caughtChecksum,
    removedActorIds: context.removedActorIds,
    placement: base.placement,
    occurrenceVersion: resumed ? resumed.expectedOccurrenceVersion + 1 : 0,
    response: input.response,
    removal: input.removal ?? null
  })
  // A push whose source picks where its creature lands holds the settled area for that pick, the
  // farthest creature first, each offer derived with the farther ones landed; it commits after the
  // last answer (D157).
  const landed = context.forcedMovement?.landed ?? []
  const forcedMovements = plan.forcedMovements.map((movement) => ({
    ...movement,
    position:
      landed.find(({ targetActorId }) => targetActorId === movement.targetActorId)?.position ?? null
  }))
  const pick = await input.forcedMovementPick({
    encounterId: input.state.id,
    sourceActorId: caster.id,
    movements: forcedMovements
  })
  if (!pick) return { ...plan, forcedMovements }
  if (input.removal)
    throw new Error('A removal that leaves an area push to pick is not supported yet.')
  return {
    kind: 'AREA_PENDING' as const,
    command,
    response: input.response,
    snapshot: holdEncounterAreaForcedMovement(areaSnapshot, pick),
    prepared: { actors: input.actors },
    fingerprint: input.fingerprint,
    initiatorUserId: context.initiatorUserId,
    occurrenceId: areaOccurrenceId
  }
}

/**
 * Plans the source's answer to a settled area's push pick (D157): the creature lands on a square the
 * pick offered, and the area holds the next creature's pick, derived with it landed, or commits.
 */
export async function planNativeLiveEncounterAreaForcedMovement(
  input: ReachPlanInput & {
    response: ResolveRuleOccurrenceInputDto
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
    landing: { requestId: string; position: ScenePoint }
  }
) {
  const { areaSnapshot, landing } = input
  const context = areaSnapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_AREA_ACTION' ||
    areaSnapshot.occurrenceId !== input.response.occurrenceId ||
    context.commandFingerprint !== input.fingerprint
  )
    throw new Error('The pending action evidence is invalid.')
  return planNativeLiveEncounterAreaCommit({
    ...input,
    areaSnapshot: landEncounterAreaForcedMovement(areaSnapshot, landing.requestId, landing.position)
  })
}

/**
 * The prepared action against a creature as its next entry in the same list finds it: the hit points
 * and Character record its earlier entry's plan left.
 */
function advanceAreaPrepared(
  prepared: AreaPrepared,
  plan: ReturnType<typeof planNativeEncounterActionMechanics>['targetPlan'],
  occurredAt: string
): AreaPrepared {
  const targetFacts = projectEncounterActionTarget({
    target: prepared.targetFacts,
    actor: plan.updatedActor,
    plan,
    campaignId: prepared.state.campaignId,
    gameSystemId: prepared.state.gameSystemId,
    occurredAt
  })
  return {
    ...prepared,
    target: plan.updatedActor,
    targetFacts,
    movementTargets: new Map(prepared.movementTargets).set(plan.updatedActor.id, targetFacts),
    binding: {
      ...prepared.binding,
      currentHitPoints: targetFacts.state.current,
      temporaryHitPoints: targetFacts.state.temporary
    }
  }
}

/**
 * The commit every multi-creature root shares, whether a point area settled its saves or a list of
 * chosen creatures was resolved at once: each creature's outcome, the caster's single spend (merged
 * into their own outcome when they are also a target), the concentration it breaks, the rules as
 * they stand after it, and the root and child contracts the room persists in one transaction.
 */
export async function completeAreaCommit(args: {
  input: AreaPlanBase
  command: ResolveEncounterActionInputDto
  caster: EncounterRunActorState
  occurredAt: string
  /** What each counter that failed against the cast spends with this commit (D127). */
  failedCounters: Awaited<ReturnType<ReachCastWindow['pause']['planFailedCounters']>>
  /** The effect each creature's used reaction to being chosen leaves on it, by actor id. */
  reactionEffects?: ReadonlyMap<
    string,
    { id: string; plan: Parameters<typeof createNativeActiveEffect>[0] }
  >
  movementTargets: ReadonlyMap<string, MovementTargets>
  kept: readonly { actor: EncounterRunActorState; target: { prepared: AreaPrepared } }[]
  lead: AreaPrepared
  ruleOverrides: ReturnType<typeof reachRuleOverrides>
  actionEconomy:
    | NonNullable<
        Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>['economy']
      >['consumption']
    | null
  attackAction: Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>['attackAction']
  settled: Awaited<ReturnType<typeof settleEncounterAreaAction>>
  /** Whether each entry of `kept` rolled its own dice (a projectile list) rather than sharing one set. */
  rollsPerTarget: boolean
  /** The settled saves; only a Legendary Resistance audit reads one. */
  tests: readonly Pick<Awaited<ReturnType<typeof replayAreaTargetSave>>, 'actorId' | 'boundary'>[]
  audits: ReturnType<typeof encounterAreaLegendaryResistanceAudits>
  areaOccurrenceId: string
  /** The pending area this commit settles; null for a list of chosen creatures that commits at once. */
  areaSnapshot: ServerAggregateChoicePendingSnapshotDto | null
  caughtChecksum: string
  removedActorIds: readonly string[]
  /** The zone an action leaves at the picked point, with the area it fills. */
  placement: AreaReach['placement']
  occurrenceVersion: number
  response: ResolveRuleOccurrenceInputDto | null
  removal: RemoveAreaTargetInputDto | null
  /** The Creature every kept creature swaps into when the action authors forms (D130). */
  formCreature?: EncounterActorFormCreature | null
}) {
  const {
    input,
    command,
    caster,
    occurredAt,
    failedCounters,
    reactionEffects,
    movementTargets,
    kept,
    lead,
    ruleOverrides,
    actionEconomy,
    attackAction,
    settled,
    rollsPerTarget,
    tests,
    audits,
    areaOccurrenceId,
    areaSnapshot,
    caughtChecksum,
    removedActorIds,
    placement,
    occurrenceVersion,
    response,
    removal,
    formCreature
  } = args
  const { state, actors } = input
  const userId = input.initial.expectedUserId
  // The caster's counters to a counter cast against its cast spend in the caster's one batch with the cast;
  // a kept creature that countered pays its slot in its own first outcome.
  const casterCounterConsumptions = counterConsumptionsOf(failedCounters, caster.id)
  const failedReactorSlots = new Set(
    failedCounters.flatMap(({ receipt, spellConsumption }) =>
      spellConsumption ? [receipt.reaction.reactorActorId] : []
    )
  )
  const children = []
  const createdEffects = new Map<string, ActiveRuleEffectRecord[]>()
  const forcedMovements: LiveSessionForcedMovement[] = []
  // The cast ends the caster's effects that end on a cast (Invisibility), and releases the condition
  // each held alone: in the caster's spend batch, or on their first outcome when the area catches them.
  const dispositions = new Map(actors.map(({ id, disposition }) => [id, disposition]))
  const { consumedGrants, sourceReleases } = actionEndedEffects({
    holderActorId: caster.id,
    held: input.activeEffectsByActorId.get(caster.id) ?? [],
    makesAttackRoll: false,
    castsSpell: preparedCastsSpell(lead),
    againstEnemy: actsAgainstEnemy({
      actorId: caster.id,
      targetActorIds: kept.map(({ actor }) => actor.id),
      dispositions
    })
  })
  // Damage an outcome deals ends the effects its target holds that end on damage; a creature named
  // again keeps what an earlier entry ended ended.
  const damageEndedEffects = new Map<string, ActiveRuleEffectRecord>()
  const entries = encounterChosenActorEntries(
    areaOccurrenceId,
    kept.map(({ actor }) => actor.id)
  )
  // One Concentration spans every creature the area caught: the first outcome that maintains an
  // effect creates the one maintained state (and carries the replacement of the caster's prior
  // one); each later outcome joins it.
  const maintenance = await prepareNativeLiveActionMaintenance({
    prepared: lead,
    activeEffectsByActorId: input.activeEffectsByActorId,
    capture: input.capture,
    loadCarriedHolder: async (carrier) =>
      movementTargets.get(carrier.id) ?? input.loadTarget(carrier)
  })
  const removedIds = new Set(maintenance?.removed.map((effect) => effect.id))
  let maintainedState: ReturnType<typeof prepareNativeLiveMaintainedState> | null = null
  let maintenanceCarried = false
  // The zone's own record, then one per band beside its wall (D154), all in the cast's maintenance.
  // They are named before the outcomes, so the hold a failed appear save leaves names its zone.
  const zoneIds = placement
    ? [crypto.randomUUID(), ...placement.regions.map(() => crypto.randomUUID())]
    : []
  const planZones = (maintainedEffectStateId: string | null) => {
    if (!placement) return []
    const zoneInput = {
      zone: placement.zone,
      maintainedEffectStateId: placement.zone.maintenance ? maintainedEffectStateId : null,
      encounterId: state.id,
      occurrenceId: areaOccurrenceId,
      rootCommandId: command.commandId,
      sourceActorId: caster.id,
      point: placement.origin,
      area: placement.shape,
      sourceToken: placement.sourceToken,
      saveDc: lead.characterActionState?.actionMechanic.save?.dc ?? null,
      unaffectedActorIds: placement.unaffectedActorIds
    }
    return [
      planEncounterPlacedZone({ ...zoneInput, id: zoneIds[0]! }),
      ...planEncounterZoneBands({
        ...zoneInput,
        ids: zoneIds.slice(1),
        regions: placement.regions
      })
    ]
  }
  const holdingZone = placement?.zone.heldCondition
    ? { record: planZones(null)[0]!, maintenance: placement.zone.maintenance }
    : undefined
  // A creature named again meets the hit points and Character record its earlier entries left it.
  const advanced = new Map<string, AreaPrepared>()
  for (const [index, { actor, target }] of kept.entries()) {
    const prepared = advanced.get(actor.id) ?? target.prepared
    const { occurrenceId } = entries[index]!
    const complete = settled.find((entry) => entry.occurrenceId === occurrenceId)?.complete
    if (!complete) throw new Error('The area outcome is unavailable.')
    const commandId = encounterAreaTargetCommandId(occurrenceId)
    const effects = prepareNativeActionEffectsPlan({
      prepared,
      execution: complete,
      occurrenceId,
      commandId,
      activeEffectsByActorId: input.activeEffectsByActorId,
      link: { memberActorIds: [...new Set(kept.map((entry) => entry.actor.id))] },
      ...(formCreature ? { form: { creatureId: formCreature.sourceId } } : {}),
      holdingZone
    })
    if (effects.maintenance)
      maintainedState ??= prepareNativeLiveMaintainedState({
        completedPolicy: effects.maintenance,
        maintenance,
        encounterId: state.id,
        ownerActorId: caster.id,
        actionId: command.actionId,
        sourceOccurrenceId: areaOccurrenceId,
        occurredAt
      })
    const joined = effects.maintenance ? maintainedState : null
    // A creature named again meets the effects its earlier entries left it.
    const earlier = createdEffects.get(actor.id) ?? []
    const targetEffects = [
      ...(input.activeEffectsByActorId.get(actor.id) ?? []).filter(
        (effect) => !joined || !removedIds.has(effect.id)
      ),
      ...earlier
    ]
    const effectInput = {
      owner: nativeEffectOwner(prepared.target, state.id),
      currentEffects: targetEffects,
      occurredAt
    }
    const stateEffect =
      effects.stateEffect && createNativeActiveEffect(effects.stateEffect, effectInput)
    const recurringEffect =
      effects.recurringEffect &&
      createNativeActiveEffect(effects.recurringEffect, {
        ...effectInput,
        maintainedEffectStateId: joined?.id
      })
    const riderEffect =
      effects.riderEffect &&
      createNativeActiveEffect(effects.riderEffect, {
        ...effectInput,
        maintainedEffectStateId: joined?.id
      })
    const firstEntry = kept.findIndex((entry) => entry.actor.id === actor.id) === index
    // The effect of a reaction the creature used on being chosen lands with its first outcome.
    const reaction = firstEntry ? reactionEffects?.get(actor.id) : undefined
    const reactionRecord =
      reaction && createNativeActiveEffect(reaction.plan, { ...effectInput, id: reaction.id })
    const created = [stateEffect, recurringEffect, riderEffect, reactionRecord].flatMap((effect) =>
      effect ? [effect] : []
    )
    const effectTransitions = projectNativeActionEffectTransitions({
      state: stateEffect,
      recurring: recurringEffect,
      rider: riderEffect,
      targetActorId: actor.id
    })
    const createdDependentEffectIds = effectTransitions.activeEffectTransitions.map(
      (effect) => effect.activeEffectId
    )
    const maintenanceTransition =
      joined && maintenance
        ? maintenanceCarried
          ? buildEncounterJoinedMaintenanceTransition({
              createdState: joined,
              createdDependentEffectIds
            })
          : buildEncounterMaintenanceTransition({
              maintenance,
              createdState: joined,
              createdDependentEffectIds
            })
        : null
    if (joined) maintenanceCarried = true
    createdEffects.set(actor.id, [...earlier, ...created])
    forcedMovements.push(
      ...interpretForcedMovements(prepared, {
        execution: complete.execution,
        occurrenceId,
        published: complete.published,
        targetActorId: actor.id
      })
    )
    // A Character caster caught by their own area spends in the same Sheet write as their first outcome.
    const carriesSpend =
      caster.kind === 'CHARACTER' && actor.id === caster.id && !advanced.has(actor.id)
    const carriesFailedCounterSpend =
      actor.id !== caster.id && failedReactorSlots.has(actor.id) && firstEntry
    const applications = [...complete.applications, ...effects.relationshipConditionApplications]
    const damageEnded = targetEndedEffects({
      holderActorId: actor.id,
      held: (input.activeEffectsByActorId.get(actor.id) ?? []).filter(
        ({ id }) => !damageEndedEffects.has(id) && !consumedGrants.some((ended) => ended.id === id)
      ),
      attacked: prepared.makesAttackRoll,
      applications,
      damagerActorId: caster.id,
      dispositions
    })
    for (const ended of damageEnded.endedEffects) damageEndedEffects.set(ended.id, ended)
    const enterForm =
      recurringEffect && formCreature ? actorFormEntry(recurringEffect, formCreature) : undefined
    const mechanics = planNativeEncounterActionMechanics(
      {
        prepared,
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        occurrenceId,
        sourceCommandId: command.commandId,
        commandId,
        occurredAt,
        applications,
        damageReleases: damageEnded.releases,
        sourceSpend: carriesSpend ? 'WITH_OUTCOME' : 'NONE',
        forceTargetVersionAdvance:
          prepared.target.kind === 'CHARACTER' && (created.length > 0 || carriesFailedCounterSpend),
        ...(carriesSpend
          ? { sourceReleases, counterSpellConsumptions: casterCounterConsumptions }
          : {}),
        ...(enterForm ? { enterForm } : {})
      },
      userId
    )
    if (kept.some((later, laterIndex) => laterIndex > index && later.actor.id === actor.id))
      advanced.set(actor.id, advanceAreaPrepared(prepared, mechanics.targetPlan, occurredAt))
    const audit = audits.get(actor.id)
    let resistance: ReturnType<typeof encounterTargetLegendaryResistance> | null = null
    if (audit) {
      const test = tests.find((entry) => entry.actorId === actor.id)
      if (!test) throw new Error('The area outcome is unavailable.')
      const candidate = await discoverNativeLegendaryResistance(input, prepared)()
      const resource =
        candidate &&
        findEncounterFeatureResource(
          prepared.actorRules,
          candidate.targetActorId,
          candidate.ownerFeatureId
        )
      if (!candidate || !resource) throw new Error('Legendary Resistance evidence is stale.')
      resistance = encounterTargetLegendaryResistance({
        audit,
        candidate,
        boundary: test.boundary,
        currentFeatureResource: resource
      })
    }
    children.push({
      actorId: actor.id,
      occurrenceId,
      carriesSpend,
      complete,
      mechanics,
      createdEffects: created,
      resistance,
      execution: buildEncounterActionStoredExecution({
        prepared,
        execution: complete,
        occurrenceId,
        occurrenceVersion: 0,
        settled: mechanics,
        effects: effectTransitions,
        maintainedState: joined,
        maintenanceTransition,
        actionEconomy: null,
        attackAction: null,
        area: { parentOccurrenceId: areaOccurrenceId },
        resistance,
        targetFailedCounterSpend: carriesFailedCounterSpend,
        reactionEffectTransitions: projectNativeActionEffectTransitions({
          state: null,
          recurring: reactionRecord ?? null,
          targetActorId: actor.id
        }).activeEffectTransitions
      })
    })
  }

  // A zone-only cast has no creature outcome to hold its Concentration: the area root carries it
  // and the zone depends on the state (D135).
  let zoneMaintenanceTransition: ReturnType<typeof buildEncounterMaintenanceTransition> | null =
    null
  if (placement?.zone.maintenance && maintenance && !maintainedState) {
    maintainedState = prepareNativeLiveMaintainedState({
      completedPolicy: placement.zone.maintenance,
      maintenance,
      encounterId: state.id,
      ownerActorId: caster.id,
      actionId: command.actionId,
      sourceOccurrenceId: areaOccurrenceId,
      occurredAt
    })
    zoneMaintenanceTransition = buildEncounterMaintenanceTransition({
      maintenance,
      createdState: maintainedState,
      createdDependentEffectIds: []
    })
  }

  const merged = children.find((child) => child.carriesSpend)
  const resourceState = lead.characterActionState
  const spends = Boolean(
    resourceState?.resourceConsumption ||
    resourceState?.itemConsumption ||
    resourceState?.spellConsumption ||
    lead.acceptedWieldConflict ||
    casterCounterConsumptions.length > 0
  )
  const sourceSpend = merged
    ? null
    : planNativeEncounterAreaSourceSpend(
        {
          prepared: lead,
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          occurrenceId: areaOccurrenceId,
          sourceCommandId: command.commandId,
          commandId: command.commandId,
          occurredAt,
          sourceReleases,
          counterSpellConsumptions: casterCounterConsumptions
        },
        userId
      )
  const spend = merged
    ? {
        sourceApplications: [],
        sourceCharacterStreamVersion: spends
          ? merged.mechanics.mechanics.characterStreamVersion
          : null,
        resourceReceipt: merged.mechanics.resourceReceipt,
        featureResourceReceipt: merged.mechanics.featureResourceReceipt,
        sourceItemUseStateTransition: merged.mechanics.sourceItemUseStateTransition,
        itemConsumptionReceipt: merged.mechanics.itemConsumptionReceipt,
        spellConsumptionReceipt: merged.mechanics.spellConsumptionReceipt
      }
    : sourceSpend!
  const sourceLabel = encounterActionSourceLabel(lead.source)
  const damageSources = children.map((child) => ({
    targetActorId: child.actorId,
    applications: child.mechanics.mechanics.receiptApplications,
    sourceLabel
  }))
  const damage = nativeConcentrationDamageApplications(damageSources, false)
  const placedZones = planZones(maintainedState?.id ?? null)
  // The placed zone's timed grant lands on the creature that placed it (D153).
  const zoneSourceGrant =
    placedZones.length && placement?.zone.sourceGrant
      ? createNativeActiveEffect(
          prepareNativeZoneSourceGrantEffect({
            prepared: lead,
            plan: placement.zone.sourceGrant,
            published:
              lead.plan.kind === 'SINGLE_GRAPH' ? lead.plan.published : lead.plan.test.published,
            occurrenceId: areaOccurrenceId,
            commandId: command.commandId,
            activeEffectsByActorId: input.activeEffectsByActorId
          }),
          {
            owner: nativeEffectOwner(caster, state.id),
            currentEffects: [
              ...(input.activeEffectsByActorId.get(caster.id) ?? []).filter(
                (effect) => !maintainedState || !removedIds.has(effect.id)
              ),
              ...(createdEffects.get(caster.id) ?? [])
            ],
            occurredAt
          }
        )
      : null
  if (zoneSourceGrant)
    createdEffects.set(caster.id, [...(createdEffects.get(caster.id) ?? []), zoneSourceGrant])
  const execution = buildEncounterAreaStoredExecution({
    occurrenceId: areaOccurrenceId,
    occurrenceVersion,
    actorId: caster.id,
    sourceCharacterId: caster.kind === 'CHARACTER' ? caster.sourceId : null,
    caughtChecksum,
    removedActorIds,
    targetOccurrenceIds: children.map((child) => child.occurrenceId),
    placedSpatialEffectIds: placedZones.map(({ id }) => id),
    maintenanceTransition: zoneMaintenanceTransition,
    sourceGrantTransition: zoneSourceGrant
      ? projectNativeActionEffectTransitions({
          state: null,
          recurring: zoneSourceGrant,
          targetActorId: caster.id
        }).activeEffectTransitions[0]!
      : null,
    damage,
    spend,
    actionEconomy,
    attackAction
  })

  // The actors as persistence leaves them: the caster's resource write, each outcome, each charge a
  // Legendary Resistance spent, then the caster's feature charge, action economy and Attack action.
  const settledActors = new Map(actors.map((actor) => [actor.id, actor] as const))
  if (sourceSpend?.sourceResourcePlan)
    settledActors.set(caster.id, sourceSpend.sourceResourcePlan.updatedActor)
  for (const child of children) {
    const updated = child.mechanics.mechanics.updatedActor
    const charge = child.resistance?.charge
    settledActors.set(
      child.actorId,
      charge
        ? encounterRunActorStateSchema.parse({
            ...updated,
            resources: withFeatureChargeUsed(updated, charge.ownerFeatureId, charge.afterUsed)
          })
        : updated
    )
  }
  // A creature that failed to counter the cast has spent its reaction. A kept creature pays it in its
  // own outcome; the caster's and any other creature's are paid by persistence.
  for (const { receipt, economy } of failedCounters) {
    const reactor = settledActors.get(receipt.reaction.reactorActorId)
    if (
      reactor &&
      reactor.id !== caster.id &&
      children.some((child) => child.actorId === reactor.id)
    )
      settledActors.set(
        reactor.id,
        consumeEncounterActionEconomy({ actor: reactor, consumption: economy, overridden: false })
      )
  }
  let settledCaster = settledActors.get(caster.id)!
  if (spend.featureResourceReceipt)
    settledCaster = encounterRunActorStateSchema.parse({
      ...settledCaster,
      resources: withFeatureChargeUsed(
        settledCaster,
        spend.featureResourceReceipt.ownerFeatureId,
        spend.featureResourceReceipt.afterUsed
      )
    })
  if (actionEconomy)
    settledCaster = consumeEncounterActionEconomy({
      actor: settledCaster,
      consumption: actionEconomy,
      overridden: overridesActionEconomy(ruleOverrides)
    })
  if (attackAction)
    settledCaster = applyEncounterAttackActionTransition(settledCaster, attackAction)
  settledActors.set(caster.id, settledCaster)
  const plans = new Map<
    string,
    ReturnType<typeof planNativeEncounterActionMechanics>['targetPlan'] | null
  >(children.map((child) => [child.actorId, child.mechanics.targetPlan] as const))
  if (sourceSpend && !plans.has(caster.id)) plans.set(caster.id, sourceSpend.sourceResourcePlan)
  const replaced = maintainedState && maintenance ? maintenance : null
  const activeEffectsByActorId = new Map(
    [...input.activeEffectsByActorId].map(([actorId, records]) => [
      actorId,
      replaced ? records.filter((effect) => !removedIds.has(effect.id)) : records
    ])
  )
  for (const [actorId, records] of createdEffects)
    activeEffectsByActorId.set(actorId, [
      ...(activeEffectsByActorId.get(actorId) ?? []),
      ...records
    ])
  const projectedTargets = new Map(
    [...movementTargets].map(([actorId, target]) => {
      const actor = settledActors.get(actorId)
      if (!actor) throw new Error('Encounter settlement actor is unavailable.')
      return [
        actorId,
        projectEncounterActionTarget({
          target: {
            ...target,
            activeEffects: activeEffectsByActorId.get(actorId) ?? []
          },
          actor,
          plan: plans.get(actorId) ?? null,
          campaignId: state.campaignId,
          gameSystemId: state.gameSystemId,
          occurredAt
        })
      ] as const
    })
  )
  const reconciled = projectNativeLiveMaintenanceOwners({
    actors: actors.map((actor) => settledActors.get(actor.id)!),
    projectedTargets,
    activeEffectsByActorId,
    maintenance: replaced ?? { owners: [], removed: [], characterVersions: [] },
    createdEffects: [...createdEffects.values()].flat(),
    characterPlans: plans,
    campaignId: state.campaignId,
    gameSystemId: state.gameSystemId,
    occurredAt
  })
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: occurredAt
  })
  const concentration = await planNativeLiveConcentration({
    state: nextState,
    autoRollByActorId: input.autoRollByActorId,
    parentOccurrenceId: areaOccurrenceId,
    parentCommandFingerprint: input.fingerprint,
    applications: damage,
    sourceLabels: nativeConcentrationDamageSourceLabels(damageSources, false),
    occurredAt,
    settlement: {
      ...reconciled,
      maintainedState,
      createdEffects: [...createdEffects.values()].flat()
    },
    capture: input.capture,
    runtime: input.runtime,
    random: input.random
  })
  const nextFacts = buildEncounterActorRuleFacts({
    actors: concentration.actors
  })
  const rules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({
      gameSystemId: state.gameSystemId,
      facts: nextFacts
    }),
    nextFacts,
    { output: lead.actorRules }
  )
  return {
    kind: 'AREA_COMMIT' as const,
    command,
    response,
    removal,
    area: areaSnapshot,
    prepared: { actors },
    occurredAt,
    initialDefinitionId:
      children[0]?.complete.initialPublished.id ??
      (lead.plan.kind === 'SINGLE_GRAPH' ? lead.plan.published.id : lead.plan.test.published.id),
    execution,
    targets: children.map(({ actorId, execution: targetExecution, createdEffects: created }) => ({
      actorId,
      execution: targetExecution,
      createdEffects: created
    })),
    rollsPerTarget,
    rules,
    maintainedState,
    resourceConsumption: resourceState?.resourceConsumption ?? null,
    itemConsumption: resourceState?.itemConsumption ?? null,
    spellConsumption: resourceState?.spellConsumption ?? null,
    failedCounters,
    consumedGrants: [...consumedGrants, ...damageEndedEffects.values()],
    label: sourceLabel,
    ruleOverrides,
    concentration,
    placedZones,
    zoneSourceGrant,
    forcedMovements
  }
}

/** The completed area and its per-creature child contracts the room persists in one transaction. */
export function buildNativeLiveEncounterAreaCommitInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Extract<
    Awaited<ReturnType<typeof planNativeLiveEncounterAreaCommit>>,
    { kind: 'AREA_COMMIT' }
  > & {
    dependencies: readonly { request: LiveSessionEncounterRulesRequest }[]
    revisions: LiveSessionRulesRevisions
  }
) {
  const owners = new Map(
    plan.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER'
        ? [[checksumRuleDocument(request), request] as const]
        : []
    )
  )
  return liveSessionEncounterAreaCommitInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    removal: plan.removal,
    revisions: plan.revisions,
    maintenanceOwners: [...owners.values()],
    maintainedState: plan.maintainedState,
    occurredAt: plan.occurredAt,
    initialDefinitionId: plan.initialDefinitionId,
    execution: plan.execution,
    targets: plan.targets,
    rollsPerTarget: plan.rollsPerTarget,
    area: plan.area,
    placedZones: plan.placedZones,
    zoneSourceGrant: plan.zoneSourceGrant,
    forcedMovements: plan.forcedMovements,
    rules: plan.rules,
    resourceConsumption: plan.resourceConsumption,
    itemConsumption: plan.itemConsumption,
    spellConsumption: plan.spellConsumption,
    failedCounters: plan.failedCounters.map(({ receipt, spellConsumption }) => ({
      receipt,
      spellConsumption
    })),
    consumedGrants: plan.consumedGrants,
    label: plan.label,
    ruleOverrides: plan.ruleOverrides,
    concentration: plan.concentration.completed,
    pendingConcentration: plan.concentration.pending,
    concentrationEnds: plan.concentration.concentrationEnds,
    endedGrants: plan.concentration.endedGrants
  })
}
