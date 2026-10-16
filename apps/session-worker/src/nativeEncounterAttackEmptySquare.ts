import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterEmptySquareCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { sceneBaseSquareSize } from '@artificer-toolkit/shared/vtt'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { encounterActionCurrentnessChecksum } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { planNativeEncounterAreaSourceSpend } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import {
  buildEncounterActionPendingSnapshot,
  restoreEncounterActionPending
} from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import {
  encounterActionSuppressedWarning,
  evaluateEncounterActionRuleWarnings,
  overridesActionEconomy,
  RULE_WARNINGS_MESSAGE
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { applyEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import {
  emptySquareAttackD20Policy,
  settleEmptySquareAttack
} from '@artificer-toolkit/rules-runtime/encounterAttackEmptySquare'
import { ENCOUNTER_SQUARE_STRANGER_ACTOR_ID } from '@artificer-toolkit/rules-runtime/encounterAttackPerception'
import { startEncounterBasicActionCheck } from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { effectsEndedBy } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { readNativeLiveBelievedSquareAttackPerception } from './nativeAttackPerception.js'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import { refuseActionOutsideItsWindow } from './nativeEncounterActionInputs.js'
import {
  prepareCasterActionOnTarget,
  prepareCasterSource,
  type AreaPlanBase
} from './nativeEncounterAreaRules.js'

export type SquareCommand = Extract<ResolveEncounterActionInputDto, { type: 'RESOLVE_ACTION' }> & {
  target: Extract<ResolveEncounterActionInputDto['target'], { kind: 'SQUARE' }>
}

type SquareInput = AreaPlanBase & { command: SquareCommand }

/** The attacker and the Scene the square was picked in. */
export async function prepareSquareScene(input: SquareInput) {
  const { command } = input
  // The square is a creature-targeted action aimed blind, so the action must take a creature.
  const attacker = await prepareCasterSource(input, 'ACTOR')
  const captured = await input.capture({
    kind: 'ACTION_AREA_SCENE',
    command: {
      actorId: command.actorId,
      sceneId: command.target.sceneId,
      expectedSceneVersion: command.target.expectedSceneVersion
    }
  })
  if (captured.kind !== 'ACTION_AREA_SCENE') throw new Error('Action Scene context is unavailable.')
  return { ...attacker, scene: captured.context }
}

function refuseTarget(message: string): never {
  throw new LiveSessionDomainRejectionError(422, {
    code: 'DOMAIN_REJECTED',
    reason: 'TARGET_UNAVAILABLE',
    message
  })
}

/**
 * The attack as it stands against a square no one is known to occupy: the attacker's action prepared
 * on themself (the only creature it can be prepared on), measured to the picked point as a
 * one-square token, and held to the warnings gate as any attack on a stranger is. The square command
 * runs it for every square, so a warning is the attacker's to acknowledge before the GM is asked;
 * `requireAttack` also refuses an action that makes no attack roll, which an empty square cannot take.
 */
export async function prepareEmptySquareAttack(
  input: SquareInput,
  base: Awaited<ReturnType<typeof prepareSquareScene>>,
  requireAttack: boolean
) {
  const { command, state, capture } = input
  const { caster, casterFacts, movementTargets, scene } = base
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')
  const grid = encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
    encounter: state,
    sceneGrid: scene.sceneGrid
  })
  const size = sceneBaseSquareSize(grid)
  const sceneContext = {
    sceneId: scene.sceneId,
    sceneVersion: scene.sceneVersion,
    sourceToken: scene.sourceToken,
    targetToken: { position: command.target.point, width: size, height: size, rotationDegrees: 0 },
    grid
  }
  const prepared = await prepareCasterActionOnTarget(input, {
    caster,
    target: caster,
    movementTargets,
    sceneContext
  })
  if (requireAttack && !prepared.makesAttackRoll)
    refuseTarget('Only an attack can be aimed at an empty square.')
  refuseActionOutsideItsWindow(prepared)
  const { activationCode, economy, suppressed, attackAction } =
    await evaluateNativeLiveActionEconomy({
      prepared,
      state,
      actionId: command.actionId,
      sourceTarget: casterFacts,
      targetIds: [],
      capture
    })
  const ruleWarnings = evaluateEncounterActionRuleWarnings({
    preparedWarnings: suppressed
      ? [...prepared.ruleWarnings, encounterActionSuppressedWarning(activationCode)]
      : prepared.ruleWarnings,
    target: {
      actor: prepared.actor,
      target: { id: ENCOUNTER_SQUARE_STRANGER_ACTOR_ID, disposition: 'NEUTRAL' },
      targetPolicy: prepared.targetPolicy,
      makesAttackRoll: prepared.makesAttackRoll,
      sceneContext
    },
    targetDefeated: false,
    stabilize: null,
    actionEconomy: economy,
    activationCode,
    acknowledged: command.acknowledgedWarnings
  })
  if (ruleWarnings.kind === 'UNSUPPORTED_TARGET')
    refuseTarget(DOMAIN_REJECTION_MESSAGES.TARGET_UNAVAILABLE)
  if (ruleWarnings.kind === 'UNACKNOWLEDGED')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: RULE_WARNINGS_MESSAGE,
      warnings: ruleWarnings.warnings
    })
  return {
    prepared,
    sceneContext,
    ruleOverrides: ruleWarnings.overrides,
    actionEconomy: economy?.consumption ?? null,
    attackAction
  }
}

/** The attacker's answer to the d20 a square ruled empty asks of them. */
type EmptySquareAnswer = {
  response: ResolveRuleOccurrenceInputDto
  resolution: EncounterEvidenceAnswer
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
}

/**
 * Plans an attack on a square the GM ruled empty. The attacker rolls the d20 the same believed
 * prompt an attack on a hidden creature shows, the attack misses whatever it shows, and the one
 * action is spent either way. It pends on the attacker's d20, or settles here when their roller
 * preference rolls for them or when they have answered.
 */
export async function planNativeLiveEncounterEmptySquare(
  input: SquareInput & { answer: EmptySquareAnswer | null }
) {
  const { command, state, actors, answer } = input
  const base = await prepareSquareScene(input)
  const { caster, casterFacts } = base
  const { prepared, sceneContext, ruleOverrides, actionEconomy, attackAction } =
    await prepareEmptySquareAttack(input, base, true)
  const currentnessChecksum = encounterActionCurrentnessChecksum({
    prepared,
    actionEconomy,
    attackAction,
    maintenance: null,
    sceneContext
  })
  const sealed = answer?.snapshot.applicationContext
  if (
    sealed &&
    (sealed.kind !== 'ENCOUNTER_ACTION' || sealed.currentnessChecksum !== currentnessChecksum)
  )
    throw new Error('The pending action source or target changed.')
  const occurrenceId = answer ? answer.response.occurrenceId : crypto.randomUUID()
  const occurrenceVersion = answer ? answer.response.expectedOccurrenceVersion + 1 : 0
  const resumed = answer ? restoreEncounterActionPending(answer.snapshot) : null
  const continuation =
    resumed?.continuation ??
    (await startEncounterBasicActionCheck({
      runtime: input.runtime,
      gameSystemId: state.gameSystemId,
      occurrenceId
    }))
  const d20Policy =
    resumed?.d20Policy ??
    emptySquareAttackD20Policy({
      prepared,
      perception: await readNativeLiveBelievedSquareAttackPerception({
        state,
        system: input.system,
        attacker: casterFacts,
        capture: input.capture
      }),
      sceneContext,
      requestNodeId: continuation.request.nodeId
    })
  const rollAnswer: EncounterEvidenceAnswer | null =
    answer?.resolution ??
    (input.requireAutoRoll(caster.id)
      ? { kind: 'AUTO_ROLL', requestId: continuation.request.requestId }
      : null)
  const initiatorUserId = input.initial.expectedUserId
  if (!rollAnswer)
    return {
      kind: 'SQUARE_PENDING' as const,
      command,
      response: null,
      snapshot: buildEncounterActionPendingSnapshot({
        execution: { kind: 'PENDING', continuation, d20Policy, twoPhase: null, roller: 'SOURCE' },
        optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
        commandJson: JSON.stringify(command),
        commandFingerprint: input.fingerprint,
        initiatorUserId,
        sourceActorId: caster.id,
        targetActorId: caster.id,
        currentnessChecksum
      }),
      prepared: { actors },
      fingerprint: input.fingerprint,
      initiatorUserId,
      occurrenceId
    }
  const occurredAt = new Date().toISOString()
  const spend = planNativeEncounterAreaSourceSpend(
    {
      prepared,
      encounterId: state.id,
      expectedEncounterVersion: state.version,
      occurrenceId,
      sourceCommandId: command.commandId,
      commandId: command.commandId,
      occurredAt
    },
    initiatorUserId
  )
  const random = input.random ?? nextRollInt
  const settled = await settleEmptySquareAttack({
    runtime: input.runtime,
    continuation,
    d20Policy,
    answer: rollAnswer,
    rollD20: () => random(20) + 1,
    occurrenceVersion,
    actorId: caster.id,
    sourceCharacterId: caster.kind === 'CHARACTER' ? caster.sourceId : null,
    spend,
    actionEconomy,
    attackAction
  })
  let settledCaster = spend.settledSource
  if (actionEconomy)
    settledCaster = consumeEncounterActionEconomy({
      actor: settledCaster,
      consumption: actionEconomy,
      overridden: overridesActionEconomy(ruleOverrides)
    })
  if (attackAction)
    settledCaster = applyEncounterAttackActionTransition(settledCaster, attackAction)
  const nextFacts = buildEncounterActorRuleFacts({
    actors: actors.map((actor) => (actor.id === caster.id ? settledCaster : actor))
  })
  const resourceState = prepared.characterActionState
  return {
    kind: 'EMPTY_SQUARE_COMMIT' as const,
    command,
    response: answer?.response ?? null,
    prepared: { actors },
    occurredAt,
    initialDefinitionId: settled.result.evidence.source.definitionId,
    actionDefinitionId:
      prepared.plan.kind === 'SINGLE_GRAPH'
        ? prepared.plan.published.id
        : prepared.plan.test.published.id,
    execution: settled.result,
    rules: reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
      nextFacts,
      { output: prepared.actorRules }
    ),
    resourceConsumption: resourceState?.resourceConsumption ?? null,
    itemConsumption: resourceState?.itemConsumption ?? null,
    spellConsumption: resourceState?.spellConsumption ?? null,
    label: encounterActionSourceLabel(prepared.source),
    ruleOverrides,
    // The attack roll uses up the attacker's one-roll grants, and a miss does too.
    consumedGrants: effectsEndedBy(
      input.activeEffectsByActorId.get(caster.id) ?? [],
      'ON_ATTACK_ROLL'
    )
  }
}

/** The completed empty-square attack the room persists in one transaction. */
export function buildNativeLiveEncounterEmptySquareCommitInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Extract<
    Awaited<ReturnType<typeof planNativeLiveEncounterEmptySquare>>,
    { kind: 'EMPTY_SQUARE_COMMIT' }
  > & { revisions: LiveSessionRulesRevisions }
) {
  return liveSessionEncounterEmptySquareCommitInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    revisions: plan.revisions,
    occurredAt: plan.occurredAt,
    initialDefinitionId: plan.initialDefinitionId,
    actionDefinitionId: plan.actionDefinitionId,
    execution: plan.execution,
    rules: plan.rules,
    resourceConsumption: plan.resourceConsumption,
    itemConsumption: plan.itemConsumption,
    spellConsumption: plan.spellConsumption,
    label: plan.label,
    ruleOverrides: plan.ruleOverrides,
    consumedGrants: plan.consumedGrants
  })
}
