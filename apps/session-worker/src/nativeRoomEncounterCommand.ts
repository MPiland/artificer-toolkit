import type {
  EncounterCommandInputDto,
  EncounterCommandResultDto,
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterPlayerProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import {
  CONVEX_RECORDED_ENCOUNTER_COMMAND_TYPES,
  type LiveSessionEncounterRoute
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import {
  LIVE_SESSION_TRY_AGAIN_MESSAGE,
  type LiveSessionCommandRejectionCodeDto
} from '@artificer-toolkit/schema/api/liveSessionCommands'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import { liveSessionEncounterTurnPendingInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'

import {
  callLiveSessionRoute,
  LiveSessionDomainRejectionError,
  LiveSessionRouteError,
  type NativeLiveSessionEnvironment
} from './liveSessionRoutes.js'
import type { LiveCaptureCache, LiveCaptureReads } from './nativeCaptureCache.js'
import { planNativeLiveBasicAction } from './nativeBasicAction.js'
import { planNativeLiveCleavingResponse } from './nativeCleavingResponse.js'
import { planNativeLiveDisarm } from './nativeDisarm.js'
import { planNativeLiveConcentrationResponse } from './nativeConcentrationResponse.js'
import {
  commitNativeLiveEncounterAction,
  commitNativeLiveEncounterActionPending,
  planNativeLiveEncounterAction
} from './nativeEncounterRules.js'
import { planNativeLiveEncounterTurn } from './nativeEncounterTurn.js'

/** The admitted room member issuing the command; every route rechecks it in Convex. */
export interface LiveEncounterActor {
  campaignId: string
  authorityEpoch: string
  expectedUserId: string
  expectedRole: 'OWNER' | 'PLAYER'
}

/**
 * Runs one Encounter command for the room: a DO planner evaluates the rules and Convex commits the
 * result atomically; roll commands take the room's dice, and only the GM tools Convex records go to
 * it as they are (`roomEncounterPlanner`).
 * The caller serializes commands and acknowledges only after this resolves.
 * Planners may reuse cached System-level captures; a refused commit (409) of a plan that reused any
 * drops those entries and replans once from fresh reads before the refusal surfaces. A movement
 * decision's answer or GM void goes back to the room (`movement`), which commits it with the Scene.
 */
export async function executeLiveEncounterCommand(input: {
  environment: NativeLiveSessionEnvironment
  accessToken: string
  actor: LiveEncounterActor
  command: EncounterCommandInputDto
  runtime: RulesRuntimeService
  random(maximum: number): number
  captureCache?: LiveCaptureCache
  movement(
    command: ResolveRuleOccurrenceInputDto | VoidRuleOccurrenceInputDto,
    captures: LiveCaptureReads | undefined
  ): Promise<EncounterCommandResultDto>
}): Promise<EncounterCommandResultDto> {
  const { environment, accessToken, actor, command, captureCache } = input
  const scope = {
    ...actor,
    encounterId: command.encounterId.toLowerCase(),
    expectedVersion: command.expectedVersion
  }
  const forward = () =>
    callLiveSessionRoute(environment, accessToken, 'encounterCommand', { ...actor, command })
  const captures = captureCache?.reads()
  let result: EncounterCommandResultDto
  try {
    result = await route(captures)
  } catch (error) {
    if (
      !(error instanceof LiveSessionRouteError) ||
      error instanceof LiveSessionDomainRejectionError ||
      error.status !== 409 ||
      !captures?.dropReused()
    )
      throw error
    result = await route(captureCache?.reads())
  }
  // Backstop: every result for a player is the redacted player projection (ADR 0034 decision 1).
  if (
    actor.expectedRole === 'PLAYER' &&
    !encounterPlayerProjectionDtoSchema.safeParse(result.projection).success
  )
    throw new Error('An Encounter result for a player was not redacted.')
  return result

  async function route(reads: LiveCaptureReads | undefined): Promise<EncounterCommandResultDto> {
    const execution = { runtime: input.runtime, random: input.random, captures: reads }
    const planned = await plannerRoute()
    // A GM void that declines a decision plans the GM's decline, then records the void.
    const result = await plan(planned.route, planned.decline ?? command, execution, reads)
    if (!planned.decline || command.type !== 'VOID_RULE_OCCURRENCE') return result
    return callLiveSessionRoute(environment, accessToken, 'encounterVoidRecord', {
      ...actor,
      command
    })
  }

  async function plan(
    planner: RoomEncounterPlanner,
    decision: EncounterCommandInputDto,
    execution: {
      runtime: RulesRuntimeService
      random(maximum: number): number
      captures?: LiveCaptureReads
    },
    reads: LiveCaptureReads | undefined
  ): Promise<EncounterCommandResultDto> {
    switch (planner) {
      case 'ACTION': {
        if (decision.type !== 'RESOLVE_ACTION' && decision.type !== 'RESOLVE_RULE_OCCURRENCE')
          throw new Error('Action planning received a non-action command.')
        const plan = await planNativeLiveEncounterAction(
          environment,
          accessToken,
          scope,
          decision,
          execution
        )
        if (plan.kind === 'REPLAY') return plan.result
        return plan.kind === 'PENDING'
          ? commitNativeLiveEncounterActionPending(environment, accessToken, scope, plan)
          : commitNativeLiveEncounterAction(environment, accessToken, scope, plan)
      }
      case 'TURN': {
        if (
          decision.type !== 'START' &&
          decision.type !== 'ADVANCE_TURN' &&
          decision.type !== 'RESOLVE_RULE_OCCURRENCE'
        )
          throw new Error('Turn planning received a non-turn command.')
        const plan = await planNativeLiveEncounterTurn(
          environment,
          accessToken,
          scope,
          decision,
          execution
        )
        if (plan.kind === 'REPLAY') return plan.result
        if (plan.prepared.kind === 'PENDING')
          return callLiveSessionRoute(
            environment,
            accessToken,
            'encounterTurnPending',
            liveSessionEncounterTurnPendingInputSchema.parse({
              ...scope,
              command: decision,
              revisions: plan.revisions,
              scenes: plan.scenes,
              snapshot: plan.prepared.snapshot
            })
          )
        if (!plan.terminal) throw new Error('Completed turn plan has no commit input.')
        return callLiveSessionRoute(environment, accessToken, 'encounterTurnCommit', plan.terminal)
      }
      case 'CONCENTRATION': {
        if (decision.type !== 'RESOLVE_RULE_OCCURRENCE')
          throw new Error('Concentration planning received a non-response command.')
        const plan = await planNativeLiveConcentrationResponse(
          environment,
          accessToken,
          scope,
          decision,
          execution
        )
        if (plan.kind === 'REPLAY') return plan.result
        return callLiveSessionRoute(
          environment,
          accessToken,
          'encounterConcentrationCommit',
          plan.input
        )
      }
      case 'CLEAVING': {
        if (decision.type !== 'RESOLVE_RULE_OCCURRENCE')
          throw new Error('Cleaving planning received a non-response command.')
        const plan = await planNativeLiveCleavingResponse(
          environment,
          accessToken,
          scope,
          decision,
          execution
        )
        if (plan.kind === 'REPLAY') return plan.result
        return callLiveSessionRoute(environment, accessToken, 'encounterCleavingCommit', plan.input)
      }
      case 'DISARM': {
        if (decision.type !== 'RESOLVE_ACTION' && decision.type !== 'RESOLVE_RULE_OCCURRENCE')
          throw new Error('Disarm planning received another command.')
        const plan = await planNativeLiveDisarm(
          environment,
          accessToken,
          scope,
          decision,
          execution
        )
        if (plan.kind === 'REPLAY') return plan.result
        return callLiveSessionRoute(
          environment,
          accessToken,
          plan.kind === 'PENDING' ? 'encounterDisarmPending' : 'encounterDisarmCommit',
          plan.input
        )
      }
      case 'BASIC_ACTION': {
        if (decision.type !== 'USE_BASIC_ACTION')
          throw new Error('Basic action planning received another command.')
        const plan = await planNativeLiveBasicAction(
          environment,
          accessToken,
          scope,
          decision,
          execution.captures
        )
        if (plan.kind === 'REPLAY') return plan.result
        return callLiveSessionRoute(
          environment,
          accessToken,
          'encounterBasicActionCommit',
          plan.input
        )
      }
      case 'MOVEMENT':
        if (decision.type !== 'RESOLVE_RULE_OCCURRENCE' && decision.type !== 'VOID_RULE_OCCURRENCE')
          throw new Error('Movement planning received a non-decision command.')
        return input.movement(decision, reads)
      case 'VOID': {
        if (decision.type !== 'VOID_RULE_OCCURRENCE')
          throw new Error('Void recording received another command.')
        const voided = { ...actor, command: decision }
        const prepared = await callLiveSessionRoute(
          environment,
          accessToken,
          'encounterVoidPrepare',
          voided
        )
        return prepared.kind === 'COMPLETE'
          ? prepared.result
          : callLiveSessionRoute(environment, accessToken, 'encounterVoidRecord', voided)
      }
      case 'ROLL': {
        if (
          decision.type !== 'ROLL_RULE_EVIDENCE' &&
          decision.type !== 'ROLL_ACTOR_INITIATIVE' &&
          decision.type !== 'ROLL_ENEMY_ACTION'
        )
          throw new Error('Rolling received a command without dice.')
        // Convex names the dice, the room draws them with its secure source, Convex records (D41).
        const rolled = { ...actor, command: decision }
        const { dice } = await callLiveSessionRoute(
          environment,
          accessToken,
          'encounterRollDice',
          rolled
        )
        return callLiveSessionRoute(environment, accessToken, 'encounterRollCommit', {
          ...rolled,
          draws: dice.map((size) => execution.random(size))
        })
      }
      case 'CONVEX':
        return forward()
    }
  }

  async function plannerRoute(): Promise<{
    route: RoomEncounterPlanner
    decline: ResolveRuleOccurrenceInputDto | null
  }> {
    const planner = roomEncounterPlanner(command)
    if (planner !== 'DECISION') return { route: planner, decline: null }
    if (command.type !== 'RESOLVE_RULE_OCCURRENCE' && command.type !== 'VOID_RULE_OCCURRENCE')
      throw new Error('Only decisions are routed by their pending occurrence.')
    return callLiveSessionRoute(environment, accessToken, 'encounterRoute', { ...actor, command })
  }
}

/**
 * The room owns Encounter movement only on its presented Scene (D42): a movement decision for an
 * Encounter the presented Scene is not bound to is refused, never sent to Convex.
 */
export function sceneNotPresentedRejection(): LiveSessionDomainRejectionError {
  return new LiveSessionDomainRejectionError(409, {
    code: 'DOMAIN_REJECTED',
    reason: 'SCENE_NOT_PRESENTED',
    message: DOMAIN_REJECTION_MESSAGES.SCENE_NOT_PRESENTED
  })
}

/**
 * What a member is told when a private route refuses their Encounter command without a domain
 * reason: Convex redacts the cause, so only the route's status is shown.
 */
export function encounterCommandRefusal(error: unknown): {
  code: LiveSessionCommandRejectionCodeDto
  message: string
} {
  const status = error instanceof LiveSessionRouteError ? error.status : 0
  if (status === 409)
    return {
      code: 'STALE_STATE',
      message: 'The Encounter changed; review the current state and try again.'
    }
  // Convex ran out of time (503): nothing changed and the same command can be retried.
  if (status === 503) return { code: 'UNAVAILABLE', message: LIVE_SESSION_TRY_AGAIN_MESSAGE }
  return {
    code: status === 401 || status === 403 ? 'FORBIDDEN' : 'UNAVAILABLE',
    message: 'The Encounter command could not be completed.'
  }
}

/**
 * A room planner, the basic-action planner (BASIC_ACTION), the room's dice for a roll command (ROLL),
 * or Convex for the GM tools it records (CONVEX_RECORDED_ENCOUNTER_COMMAND_TYPES).
 */
type RoomEncounterPlanner = LiveSessionEncounterRoute | 'BASIC_ACTION' | 'ROLL' | 'CONVEX'

const convexCommandTypes = new Set<string>(CONVEX_RECORDED_ENCOUNTER_COMMAND_TYPES)

/**
 * Which planner runs a command before any read. A decision is routed by its pending occurrence
 * (DECISION); an optional-combat intent is a Disarm, the one contested action.
 */
export function roomEncounterPlanner(command: {
  type: EncounterCommandInputDto['type']
  optionalCombatIntent?: unknown
}): RoomEncounterPlanner | 'DECISION' {
  if (command.type === 'RESOLVE_ACTION') return command.optionalCombatIntent ? 'DISARM' : 'ACTION'
  if (command.type === 'USE_BASIC_ACTION') return 'BASIC_ACTION'
  if (command.type === 'START' || command.type === 'ADVANCE_TURN') return 'TURN'
  if (command.type === 'RESOLVE_RULE_OCCURRENCE' || command.type === 'VOID_RULE_OCCURRENCE')
    return 'DECISION'
  if (
    command.type === 'ROLL_RULE_EVIDENCE' ||
    command.type === 'ROLL_ACTOR_INITIATIVE' ||
    command.type === 'ROLL_ENEMY_ACTION'
  )
    return 'ROLL'
  if (convexCommandTypes.has(command.type)) return 'CONVEX'
  throw new Error('The Encounter command has no planner.')
}
