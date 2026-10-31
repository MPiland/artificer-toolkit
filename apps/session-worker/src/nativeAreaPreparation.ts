import {
  areaActionTargetOrigin,
  type AreaActionTargetDto,
  ammunitionCommandChoice,
  castChoiceOptionId,
  healShareOf,
  type ResolveEncounterActionInputDto,
  type ResolveEncounterActionTargetDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { EncounterFailedCounterDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { type LiveSessionForcedMovement } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse,
  LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SummonStatBlockDto } from '@artificer-toolkit/schema/effects/manifest'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  CompiledActionSummonPlacement,
  CompiledActionTargetPolicy
} from '@artificer-toolkit/schema/projections/characterMechanics'
import {
  encounterActionCurrentnessChecksum,
  prepareEncounterActionMechanics,
  prepareEncounterActionSource
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { encounterSourceHandHolds } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  encounterActionSuppressedWarning,
  evaluateEncounterActorsRuleWarnings,
  evaluateEncounterAreaRuleWarnings,
  RULE_WARNINGS_MESSAGE
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { encounterConditionFleeSources } from '@artificer-toolkit/rules-runtime/encounterConditionMechanics'
import type { EncounterBasicActionCapabilityDescriptor } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  encounterActionTargetKind,
  encounterZoneChoiceTarget,
  evaluateEncounterAreaTargetPolicy,
  evaluateEncounterCasterCenteredAreaTarget,
  evaluateEncounterDirectedAreaTarget,
  evaluateEncounterSummonTarget,
  evaluateEncounterZoneTarget
} from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'
import type { FacingRule } from '@artificer-toolkit/rules-runtime/optionalCombatPolicyCapability'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { chosenZonePlacement } from '@artificer-toolkit/rules-runtime/encounterZonePlacement'
import type { EncounterForcedMovementLanding } from '@artificer-toolkit/encounter-persistence/actionCommitRecords'
import { refuseStaleCharacterAction } from '@artificer-toolkit/encounter-persistence/staleCharacterAction'
import type { EncounterActorFormCreature } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import { summonFormPick } from '@artificer-toolkit/rules-runtime/spellSummonStatBlock'
import {
  creatureSnapshotSize,
  encounterActiveEffectPlan
} from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { selectHitPointPoolTargets } from '@artificer-toolkit/rules-runtime/encounterHitPointPool'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  snapshotAbilityScore,
  snapshotCreatureTypeId
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { readNativeLiveCover } from './nativeLiveCover.js'
import {
  readNativeLivePointPerception,
  readNativeLivePointSight
} from './nativeAttackPerception.js'
import {
  captureActionEconomyDefinitions,
  evaluateNativeLiveActionEconomy
} from './nativeEncounterActionEconomy.js'
import {
  nativeLiveRelationshipFacts,
  refuseUnmetActionRestrictions
} from './nativeEncounterActionInputs.js'
import { readNativeLiveTurnMovedFeet } from './nativeTurnUses.js'
import {
  readNativeLiveSpellPins,
  type prepareNativeLiveMovementTarget
} from './nativeEncounterTargets.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { type NativeCastReactionAnswer } from './nativeEncounterCastReaction.js'
import { createNativeCastPause } from './nativeEncounterCastPause.js'
import { encounterFleeActionWarnings } from '@artificer-toolkit/rules-runtime/encounterConditionMechanics'

export type AreaCommand = Omit<ResolveEncounterActionInputDto, 'target'> & {
  target: AreaActionTargetDto
}
export type ChosenActorsCommand = Omit<ResolveEncounterActionInputDto, 'target'> & {
  target: Extract<ResolveEncounterActionTargetDto, { kind: 'ACTORS' }>
}
/** A command that opens or resumes a multi-creature action: a point area or a list of chosen creatures. */
export type ReachCommand = Omit<ResolveEncounterActionInputDto, 'target'> & {
  target: AreaCommand['target'] | ChosenActorsCommand['target']
}
export type MovementTargets = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']

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
 * Where a root's forced movements land on the Encounter's Scene (D157): the pick they owe their
 * source next (the farthest creature with two or more legal squares, the farther ones already
 * landed; null when none is), and the landings so far, in the order they land.
 */
export type ForcedMovementPreview = {
  owed: { targetActorId: string; positions: ScenePoint[] } | null
  landings: readonly EncounterForcedMovementLanding[]
}

export type ForcedMovementPick = (input: {
  encounterId: string
  sourceActorId: string
  movements: readonly LiveSessionForcedMovement[]
}) => Promise<ForcedMovementPreview>

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

export type AreaPlanInput = AreaPlanBase & { command: AreaCommand }
export type ReachPlanInput = AreaPlanBase & { command: ReachCommand }

/** Why an area is refused, as the player is told. */
const AREA_REFUSALS = {
  UNSUPPORTED_AREA: "This action's area size is not supported.",
  ORIGIN_OFF_CASTER: 'This area cannot extend from there.',
  AREA_TOO_LARGE: 'This area is larger than the action allows.',
  AREA_TOO_SMALL: 'This area is too small to place.',
  SIDE_REQUIRED: 'Pick the side of the wall this zone also reaches.',
  SIDE_NOT_OFFERED: 'This zone has no side to pick.',
  UNSUPPORTED_SUMMON: "This summon's size or range is not supported.",
  SPACE_OCCUPIED: 'Another creature already fills that space.'
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
    loadSource: async (source) =>
      resolveEncounterActionSource({
        ...source,
        system: input.system,
        spells: await readNativeLiveSpellPins(input.capture)
      })
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
  const summonPlacement =
    source.kind === 'CHARACTER_ACTION' && source.entry.schemaVersion === 4
      ? (source.entry.compilation.summonPlacement ?? null)
      : null
  const takes = summonPlacement
    ? 'POINT'
    : zone
      ? (encounterZoneChoiceTarget(zone, targetPolicy.range.rangeKind)?.kind ?? null)
      : encounterActionTargetKind(targetPolicy)
  if (takes !== targetKind)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: (takes && WRONG_TARGET_MESSAGES[takes]) ?? 'This action does not take that target.'
    })
  await refuseUnmetActionRestrictions(
    { source, acceptedWieldConflict: command.acceptedWieldConflict },
    {
      target: casterFacts,
      gameSystemId: state.gameSystemId,
      definitions: captureActionEconomyDefinitions(input.capture),
      speedDefinitions: input.system.speeds,
      runEffectsByActorId: input.activeEffectsByActorId,
      readTurnMovedFeet: () => readNativeLiveTurnMovedFeet(input.capture, casterFacts.actor.id)
    }
  )
  // A zone whose cast authors a save puts each creature in its area through it as it appears (D154).
  const appearSave =
    zonePlacement !== null &&
    source.kind === 'CHARACTER_ACTION' &&
    source.entry.schemaVersion === 4 &&
    source.entry.compilation.executionPlan.kind === 'TEST_OUTCOME'
  return {
    caster,
    casterFacts,
    movementTargets,
    source,
    targetPolicy,
    zone,
    summonPlacement,
    appearSave
  }
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
  const {
    caster,
    casterFacts,
    movementTargets,
    source,
    targetPolicy,
    zone,
    summonPlacement,
    appearSave
  } = prepared ?? (await prepareCasterSource(input, command.target.kind))
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
  const grid = resolveEncounterSceneGrid({
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
  const summonBody = await readSummonBody(input, summonPlacement)
  const summonArea =
    summonBody && target.kind === 'POINT'
      ? evaluateEncounterSummonTarget({
          gameSystemId: state.gameSystemId,
          statBlock:
            summonBody.kind === 'CREATURE'
              ? { size: creatureSnapshotSize(summonBody.creature) ?? undefined }
              : summonBody.statBlock,
          range: targetPolicy.range,
          point: target.point,
          grid,
          sourceToken: scene.sourceToken,
          pointSeen: await seen(target.point),
          tokens: scene.tokens,
          actors: input.actors
        })
      : null
  const area =
    summonArea ??
    (zone && target.kind !== 'DIRECTED'
      ? evaluateEncounterZoneTarget({
          zone,
          range: targetPolicy.range,
          target,
          grid,
          sourceToken: scene.sourceToken,
          aimSeen: (await Promise.all(aimedPoints.map(seen))).every(Boolean)
        })
      : target.kind === 'CASTER_CENTERED'
        ? evaluateEncounterCasterCenteredAreaTarget({
            targetPolicy,
            grid,
            sourceToken: scene.sourceToken
          })
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
            : { refusal: 'UNSUPPORTED_AREA' as const })
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
  // A zone names any number to spare; an instant area, only as many as the caster's features allow.
  const sparesMax = zone
    ? zone.choosesUnaffected
      ? Infinity
      : 0
    : source.kind === 'CHARACTER_ACTION'
      ? (source.candidate.sparesCreatures?.max ?? 0)
      : 0
  if (
    unaffectedActorIds.length &&
    (unaffectedActorIds.length > sparesMax ||
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
    source,
    targetPolicy,
    summon:
      summonPlacement && summonBody && summonArea && 'shape' in summonArea
        ? {
            placement: summonPlacement,
            body: summonBody,
            point: origin,
            edgeLength: summonArea.shape.edgeLength
          }
        : null,
    scene: { ...scene, grid },
    area: { ...area, origin },
    placement: zone
      ? {
          zone,
          appearSave,
          origin,
          shape: area.shape,
          regions: 'regions' in area ? area.regions : [],
          distanceStep: 'distanceStep' in area ? area.distanceStep : undefined,
          sourceToken: scene.sourceToken ?? null,
          unaffectedActorIds
        }
      : null
  }
}

const summonFormRefusal = (message: string) =>
  new LiveSessionDomainRejectionError(422, {
    code: 'DOMAIN_REJECTED',
    reason: 'TARGET_UNAVAILABLE',
    message
  })

/**
 * The body a summon conjures: its own stat block, or for a summon that authors forms the one the
 * caster picked, read from the System creature corpus, with the creature type the caster picked when
 * the summon offers several. Only a summon that authors forms takes either pick.
 */
async function readSummonBody(
  input: AreaPlanInput,
  placement: CompiledActionSummonPlacement | null
): Promise<
  | { kind: 'STAT_BLOCK'; statBlock: SummonStatBlockDto }
  | {
      kind: 'CREATURE'
      creature: EncounterActorFormCreature
      creatureTypeId: string | null
      label: string
    }
  | null
> {
  const { target } = input.command
  const pick = summonFormPick(
    placement,
    target.kind === 'POINT' ? { formId: target.formId, creatureTypeId: target.creatureTypeId } : {}
  )
  if (pick && 'refusal' in pick) throw summonFormRefusal(pick.refusal)
  if (!pick)
    return placement && 'statBlock' in placement
      ? { kind: 'STAT_BLOCK', statBlock: placement.statBlock }
      : null
  if (!input.readFormCreature) throw new Error('The creature form cannot be read.')
  return {
    kind: 'CREATURE',
    creature: await input.readFormCreature(input.state.gameSystemId, pick.form.creatureId),
    creatureTypeId: pick.creatureTypeId,
    label: pick.form.label
  }
}

export type AreaScene = Awaited<ReturnType<typeof prepareAreaScene>>
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
  /** The creature the action summons at the picked point; only a point action authors one. */
  summon?: AreaScene['summon']
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
      grid: resolveEncounterSceneGrid({
        encounter: state,
        sceneGrid: captured.context.sceneGrid
      })
    }
  }
}

/** The reach of a pending multi-creature action, read again as the room stands now. */
export async function prepareReach(input: ReachPlanInput): Promise<AreaReach> {
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
    command: Pick<
      ResolveEncounterActionInputDto,
      'actionId' | 'castModifierId' | 'spentUnits' | 'acceptedWieldConflict' | 'target'
    >
  },
  action: {
    caster: EncounterRunActorState
    target: EncounterRunActorState
    movementTargets: ReadonlyMap<string, MovementTargets>
    sceneContext: Parameters<typeof prepareEncounterActionMechanics>[0]['sceneContext']
    /** Where an area starts: its saves are made against what each creature sees of this point. */
    origin?: { point: ScenePoint; sceneId: string; sceneVersion: number }
    /** Runs this synthetic action of the caster in place of the command action (a forced-movement collision). */
    capability?: EncounterBasicActionCapabilityDescriptor
  }
) {
  const { origin, sceneContext, capability } = action
  return prepareEncounterActionMechanics({
    state: input.state,
    actor: action.caster,
    target: action.target,
    actors: input.actors,
    actionId: capability?.actionId ?? input.command.actionId,
    choiceOptionId: capability ? undefined : castChoiceOptionId(input.command.target),
    castModifierId: capability ? undefined : input.command.castModifierId,
    spentUnits: capability ? undefined : input.command.spentUnits,
    dividedAmount: capability ? undefined : healShareOf(input.command.target, action.target.id),
    ammunition: ammunitionCommandChoice(input.command.target),
    wieldConflictAcceptance: {
      kind: 'PROMPTED',
      accepted: capability ? null : input.command.acceptedWieldConflict,
      handHolds: encounterSourceHandHolds(input.activeEffectsByActorId, action.caster.id)
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
    loadCover:
      origin && sceneContext
        ? ({ sourceFacts, targetFacts }) =>
            readNativeLiveCover({
              state: input.state,
              system: input.system,
              sourceActorId: sourceFacts.actor.id,
              targetActorId: targetFacts.actor.id,
              originPoint: origin.point,
              refuseBlocked: true,
              sceneContext: {
                sceneId: origin.sceneId,
                sceneVersion: origin.sceneVersion,
                grid: sceneContext.grid
              },
              capture: input.capture
            })
        : undefined,
    loadSource: async (source) =>
      capability
        ? { kind: 'BASIC_ACTION', actor: action.caster, capability }
        : resolveEncounterActionSource({
            ...source,
            system: input.system,
            spells: await readNativeLiveSpellPins(input.capture)
          }),
    loadRelationshipFacts: nativeLiveRelationshipFacts({
      activeEffectsByActorId: input.activeEffectsByActorId
    })
  }).catch(refuseStaleCharacterAction)
}

/** The counter window of a multi-creature cast, held over the caster's lead preparation of the action. */
export function reachCastPause(
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
        resolveEncounterActionSource({
          ...source,
          system: input.system,
          spells: await readNativeLiveSpellPins(input.capture)
        }),
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
        currentnessChecksum,
        // Area effects are not gated by an incoming-attack ward.
        passedIncomingGate: undefined
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
export function hitPointPoolCovered<Caught extends { actor: EncounterRunActorState }>(
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

/** One creature a multi-creature action reaches, prepared as the action opened. */
export type ReachTarget = Awaited<ReturnType<typeof prepareAreaTarget>> & {
  actor: EncounterRunActorState
  /** Whether the caster perceived the creature as the action opened (D100). */
  perceivedByCaster: boolean
}

export type AreaPrepared = Awaited<ReturnType<typeof prepareAreaTarget>>['prepared']

export function leadActiveEffectPlan(prepared: AreaPrepared) {
  return encounterActiveEffectPlan(
    prepared,
    prepared.plan.kind === 'SINGLE_GRAPH' ? prepared.plan.published : prepared.plan.test.published
  )
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
  facing: FacingRule | null
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
  const linkFloor =
    leadActiveEffectPlan(input.lead)?.actorLinkContribution?.excludesAbilityAtOrBelow ?? null
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
              sceneContext,
              facing: input.facing
            },
            targetDefeated: isEncounterActorDefeated(prepared.target, deadCharacterIds),
            targetCreatureTypeId: snapshotCreatureTypeId(prepared.target),
            targetLinkAbilityScore:
              linkFloor && snapshotAbilityScore(prepared.target, linkFloor.ability)
          })),
          linkAbilityFloor: linkFloor?.score ?? null
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
