import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterActionPendingInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse,
  LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterActionCurrentnessChecksum,
  prepareEncounterActionMechanics,
  prepareEncounterActionSource
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  encounterActionSuppressedWarning,
  evaluateEncounterAreaRuleWarnings,
  RULE_WARNINGS_MESSAGE
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  catchEncounterAreaActorIds,
  prepareEncounterAreaTests
} from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import {
  encounterActionTargetKind,
  evaluateEncounterAreaTargetPolicy
} from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import { buildEncounterAreaPendingSnapshot } from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { buildEncounterActionPendingSnapshot } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import { encounterBasicActionAllyAdvantage } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { refuseStaleCharacterAction } from '@artificer-toolkit/encounter-persistence/domainRejections'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import {
  nativeLiveRelationshipFacts,
  refuseLegendaryWindowAction
} from './nativeEncounterActionInputs.js'
import { prepareNativeLiveActionMaintenance } from './nativeEncounterMaintenance.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'

type AreaCommand = Omit<ResolveEncounterActionInputDto, 'target'> & {
  target: Extract<ResolveEncounterActionInputDto['target'], { kind: 'POINT' }>
}
type MovementTargets = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']

/**
 * Plans a point-area action up to its pending saves. Whom the area catches is decided here, from the
 * Scene the caster saw (fenced by its version); every caught creature, allies and the caster
 * included, gets its own sealed save, and none is rolled until its roller answers.
 */
export async function planNativeLiveEncounterAreaAction(input: {
  initial: LiveSessionEncounterRulesInput
  command: AreaCommand
  fingerprint: string
  state: EncounterRunState
  system: Extract<LiveSessionEncounterRulesResponse, { kind: 'INPUTS' }>['system']
  actors: readonly EncounterRunActorState[]
  activeEffectsByActorId: Map<string, ActiveRuleEffectRecord[]>
  loadTarget: (actor: EncounterRunActorState) => Promise<MovementTargets>
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => ReturnType<LiveCaptureReads['encounterRules']>
  runtime: RulesRuntimeService
  random?: (maximum: number) => number
}) {
  const { command, state, actors, capture } = input
  const caster = actors.find((actor) => actor.id === command.actorId)
  if (!caster) throw new Error('Encounter rules input binding mismatch.')
  const casterFacts = await input.loadTarget(caster)
  const movementTargets = new Map([[caster.id, casterFacts]])
  const { targetPolicy } = await prepareEncounterActionSource({
    state,
    actor: caster,
    actionId: command.actionId,
    sourceFacts: casterFacts,
    loadSource: async (source) => resolveEncounterActionSource({ ...source, system: input.system })
  }).catch(refuseStaleCharacterAction)
  // Only an area action takes a point; any other action names a creature instead.
  if (encounterActionTargetKind(targetPolicy) !== 'POINT')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'This action does not take a point.'
    })
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
  const area = evaluateEncounterAreaTargetPolicy({
    targetPolicy,
    point: command.target.point,
    grid,
    sourceToken: scene.sourceToken
  })
  if (!area) throw new Error('The selected action area is not supported.')

  const caughtActorIds = catchEncounterAreaActorIds({
    origin: command.target.point,
    shape: area.shape,
    tokens: scene.tokens.map((token) => ({ ...token, id: token.tokenId }))
  })
  if (caughtActorIds.length === 0)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'The area catches no creature.'
    })
  const caught = caughtActorIds.map((actorId) => {
    const actor = actors.find((candidate) => candidate.id === actorId)
    const token = scene.tokens.find((candidate) => candidate.actorId === actorId)
    if (!actor || !token) throw new Error('Encounter rules input binding mismatch.')
    return { actor, token }
  })
  for (const { actor } of caught)
    if (!movementTargets.has(actor.id)) movementTargets.set(actor.id, await input.loadTarget(actor))

  const allyAdvantage = encounterBasicActionAllyAdvantage({ actors, attackerId: caster.id })
  const preparedTargets = []
  for (const { actor, token } of caught) {
    const sceneContext = {
      sceneId: scene.sceneId,
      sceneVersion: scene.sceneVersion,
      sourceToken: scene.sourceToken,
      targetToken: token,
      grid
    }
    preparedTargets.push({
      token,
      sceneContext,
      prepared: await prepareEncounterActionMechanics({
        state,
        actor: caster,
        target: actor,
        actors,
        actionId: command.actionId,
        wieldConflictAcceptance: { kind: 'PROMPTED', accepted: command.acceptedWieldConflict },
        overridable: true,
        movementTargets,
        sceneContext,
        loadSource: async (source) =>
          resolveEncounterActionSource({ ...source, system: input.system }),
        loadRelationshipFacts: nativeLiveRelationshipFacts({
          activeEffectsByActorId: input.activeEffectsByActorId,
          allyAdvantage
        })
      }).catch(refuseStaleCharacterAction)
    })
  }
  const [first] = preparedTargets
  if (!first) throw new Error('The area catches no creature.')
  refuseLegendaryWindowAction(first.prepared)
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')

  const { activationCode, economy, suppressed, attackAction } =
    await evaluateNativeLiveActionEconomy({
      prepared: first.prepared,
      state,
      actionId: command.actionId,
      sourceTarget: casterFacts,
      targetIds: caughtActorIds,
      capture
    })
  const ruleWarnings = evaluateEncounterAreaRuleWarnings({
    preparedWarnings: suppressed
      ? [...first.prepared.ruleWarnings, encounterActionSuppressedWarning(activationCode)]
      : first.prepared.ruleWarnings,
    areaWarnings: area.warnings,
    actionEconomy: economy,
    activationCode,
    acknowledged: command.acknowledgedWarnings
  })
  if (ruleWarnings.kind === 'UNACKNOWLEDGED')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: RULE_WARNINGS_MESSAGE,
      warnings: ruleWarnings.warnings
    })
  const actionEconomy = economy?.consumption ?? null
  const maintenance = await prepareNativeLiveActionMaintenance({
    prepared: first.prepared,
    activeEffectsByActorId: input.activeEffectsByActorId,
    capture,
    loadCarriedHolder: async (actor) => movementTargets.get(actor.id) ?? input.loadTarget(actor)
  })

  const occurrenceId = crypto.randomUUID()
  const tests = await prepareEncounterAreaTests({
    runtime: input.runtime,
    random: input.random,
    adapter: first.prepared.adapter,
    plan: first.prepared.plan,
    occurrenceId,
    targets: preparedTargets.map(({ prepared }) => ({
      actorId: prepared.target.id,
      binding: prepared.binding,
      autoRoll: { SOURCE: false, TARGET: false }
    }))
  })
  const commandJson = JSON.stringify(command)
  const initiatorUserId = input.initial.expectedUserId
  const targets = preparedTargets.map(({ prepared, token, sceneContext }) => {
    const test = tests.find((candidate) => candidate.actorId === prepared.target.id)
    if (test?.kind !== 'PENDING') throw new Error('An area save must wait for its roller.')
    return {
      actorId: prepared.target.id,
      token: {
        tokenId: token.tokenId,
        position: token.position,
        width: token.width,
        height: token.height,
        rotationDegrees: token.rotationDegrees
      },
      snapshot: buildEncounterActionPendingSnapshot({
        execution: test.pending,
        optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
        commandJson,
        commandFingerprint: input.fingerprint,
        initiatorUserId,
        sourceActorId: caster.id,
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
  const snapshot = buildEncounterAreaPendingSnapshot({
    occurrenceId,
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
    commandJson,
    commandFingerprint: input.fingerprint,
    initiatorUserId,
    casterActorId: caster.id,
    scene: { sceneId: scene.sceneId, sceneVersion: scene.sceneVersion },
    area: { origin: command.target.point, shape: area.shape },
    targets
  })
  return {
    kind: 'AREA_PENDING' as const,
    command,
    response: null,
    snapshot,
    prepared: { actors },
    ruleOverrides: ruleWarnings.overrides,
    fingerprint: input.fingerprint,
    initiatorUserId,
    occurrenceId
  }
}

/** The sealed pending contract the room persists for a point-area action: every caught creature's save. */
export function buildNativeLiveEncounterAreaActionPendingInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Pick<
    Awaited<ReturnType<typeof planNativeLiveEncounterAreaAction>>,
    'command' | 'snapshot'
  > & {
    dependencies: readonly { request: LiveSessionEncounterRulesRequest }[]
    revisions: LiveSessionRulesRevisions
  }
) {
  return liveSessionEncounterActionPendingInputSchema.parse({
    ...scope,
    command: plan.command,
    response: null,
    revisions: plan.revisions,
    maintenanceOwners: plan.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER' ? [request] : []
    ),
    snapshot: plan.snapshot
  })
}
