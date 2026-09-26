import type {
  EncounterCommandInputDto,
  EncounterCommandResultDto,
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterPlayerProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionEncounterRoute } from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { liveSessionEncounterTurnPendingInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'

import {
  callLiveSessionRoute,
  LiveSessionDomainRejectionError,
  LiveSessionRouteError,
  type NativeLiveSessionEnvironment
} from './liveSessionRoutes.js'
import type { LiveCaptureCache, LiveCaptureReads } from './nativeCaptureCache.js'
import { planNativeLiveConcentrationResponse } from './nativeConcentrationResponse.js'
import {
  commitNativeLiveEncounterAction,
  commitNativeLiveEncounterActionPending,
  planNativeLiveEncounterAction
} from './nativeEncounterRules.js'
import { planNativeLiveEncounterTurn } from './nativeEncounterTurn.js'
import { LivePlannerUnsupportedError } from './nativeRulesRuntime.js'

/** The admitted room member issuing the command; every route rechecks it in Convex. */
export interface LiveEncounterActor {
  campaignId: string
  authorityEpoch: string
  expectedUserId: string
  expectedRole: 'OWNER' | 'PLAYER'
}

/**
 * Runs one Encounter command for the room: a DO planner evaluates the rules and Convex commits the
 * result atomically, or the command is forwarded to its Convex implementation when no live planner
 * owns the flow yet. The caller serializes commands and acknowledges only after this resolves.
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
    try {
      switch (await plannerRoute()) {
        case 'ACTION': {
          if (command.type !== 'RESOLVE_ACTION' && command.type !== 'RESOLVE_RULE_OCCURRENCE')
            throw new Error('Action planning received a non-action command.')
          const plan = await planNativeLiveEncounterAction(
            environment,
            accessToken,
            scope,
            command,
            execution
          )
          if (plan.kind === 'REPLAY') return plan.result
          return plan.kind === 'PENDING'
            ? commitNativeLiveEncounterActionPending(environment, accessToken, scope, plan)
            : commitNativeLiveEncounterAction(environment, accessToken, scope, plan)
        }
        case 'TURN': {
          if (
            command.type !== 'START' &&
            command.type !== 'ADVANCE_TURN' &&
            command.type !== 'RESOLVE_RULE_OCCURRENCE'
          )
            throw new Error('Turn planning received a non-turn command.')
          const plan = await planNativeLiveEncounterTurn(
            environment,
            accessToken,
            scope,
            command,
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
                command,
                revisions: plan.revisions,
                scenes: plan.scenes,
                snapshot: plan.prepared.snapshot
              })
            )
          if (!plan.terminal) throw new Error('Completed turn plan has no commit input.')
          return callLiveSessionRoute(
            environment,
            accessToken,
            'encounterTurnCommit',
            plan.terminal
          )
        }
        case 'CONCENTRATION': {
          if (command.type !== 'RESOLVE_RULE_OCCURRENCE')
            throw new Error('Concentration planning received a non-response command.')
          const plan = await planNativeLiveConcentrationResponse(
            environment,
            accessToken,
            scope,
            command,
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
        case 'MOVEMENT':
          if (command.type !== 'RESOLVE_RULE_OCCURRENCE' && command.type !== 'VOID_RULE_OCCURRENCE')
            throw new Error('Movement planning received a non-decision command.')
          return input.movement(command, reads)
        case 'NATIVE':
          return forward()
      }
    } catch (error) {
      if (error instanceof LivePlannerUnsupportedError) return forward()
      throw error
    }
  }

  async function plannerRoute(): Promise<LiveSessionEncounterRoute> {
    if (command.type === 'RESOLVE_ACTION') return 'ACTION'
    if (command.type === 'START' || command.type === 'ADVANCE_TURN') return 'TURN'
    if (command.type !== 'RESOLVE_RULE_OCCURRENCE' && command.type !== 'VOID_RULE_OCCURRENCE')
      return 'NATIVE'
    const { route } = await callLiveSessionRoute(environment, accessToken, 'encounterRoute', {
      ...actor,
      commandType: command.type,
      encounterId: scope.encounterId,
      occurrenceId: command.occurrenceId
    })
    return route
  }
}
