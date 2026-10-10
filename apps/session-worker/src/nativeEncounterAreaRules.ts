import type {
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ServerAggregateChoicePendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { restoreEncounterActionPending } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
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
  answerEncounterAreaTest,
  catchEncounterAreaActorIds,
  prepareEncounterAreaTests
} from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import {
  encounterActionTargetKind,
  evaluateEncounterAreaTargetPolicy
} from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import {
  buildEncounterAreaPendingSnapshot,
  encounterAreaTargetOccurrenceId,
  markEncounterAreaSaveTested
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
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

type AreaPlanInput = {
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
}

/** What every creature of one area shares: the caster, the Scene the point was picked in, and the area. */
async function prepareAreaScene(input: AreaPlanInput) {
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
  return { caster, casterFacts, movementTargets, scene, grid, area }
}

/** One creature's action mechanics against the point's Scene, as its sealed save was prepared. */
async function prepareAreaTarget(
  input: AreaPlanInput & {
    base: Awaited<ReturnType<typeof prepareAreaScene>>
    actor: EncounterRunActorState
    token: Awaited<ReturnType<typeof prepareAreaScene>>['scene']['tokens'][number]
    allyAdvantage: ReturnType<typeof encounterBasicActionAllyAdvantage>
  }
) {
  const { base, actor, token, command, state, actors } = input
  const sceneContext = {
    sceneId: base.scene.sceneId,
    sceneVersion: base.scene.sceneVersion,
    sourceToken: base.scene.sourceToken,
    targetToken: token,
    grid: base.grid
  }
  return {
    token,
    sceneContext,
    prepared: await prepareEncounterActionMechanics({
      state,
      actor: base.caster,
      target: actor,
      actors,
      actionId: command.actionId,
      wieldConflictAcceptance: { kind: 'PROMPTED', accepted: command.acceptedWieldConflict },
      overridable: true,
      movementTargets: base.movementTargets,
      sceneContext,
      loadSource: async (source) =>
        resolveEncounterActionSource({ ...source, system: input.system }),
      loadRelationshipFacts: nativeLiveRelationshipFacts({
        activeEffectsByActorId: input.activeEffectsByActorId,
        allyAdvantage: input.allyAdvantage
      })
    }).catch(refuseStaleCharacterAction)
  }
}

/**
 * Plans a point-area action up to its pending saves. Whom the area catches is decided here, from the
 * Scene the caster saw (fenced by its version); every caught creature, allies and the caster
 * included, gets its own sealed save, and none is rolled until its roller answers.
 */
export async function planNativeLiveEncounterAreaAction(input: AreaPlanInput) {
  const { command, state, actors, capture } = input
  const base = await prepareAreaScene(input)
  const { caster, casterFacts, movementTargets, scene, grid, area } = base

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
  for (const { actor, token } of caught)
    preparedTargets.push(await prepareAreaTarget({ ...input, base, actor, token, allyAdvantage }))
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

/**
 * Plans one creature's answer to its save in a pending area. The answer is checked against that
 * creature's own sealed facts and kept with its save; no other creature is touched, and nothing is
 * rolled for damage until the area settles.
 */
export async function planNativeLiveEncounterAreaAnswer(
  input: AreaPlanInput & {
    response: ResolveRuleOccurrenceInputDto
    resolution: EncounterEvidenceAnswer
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
  }
) {
  const { command, state, actors, capture, areaSnapshot, resolution } = input
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
      encounterAreaTargetOccurrenceId(areaSnapshot.occurrenceId, answered.actorId) ||
    context.commandFingerprint !== input.fingerprint ||
    command.optionalCombatIntent != null
  )
    throw new Error('The pending action evidence is invalid.')
  const base = await prepareAreaScene(input)
  if (
    base.scene.sceneVersion !== context.scene.sceneVersion ||
    checksumCanonicalJson(base.area.shape) !== checksumCanonicalJson(context.area.shape)
  )
    throw new Error('The pending area changed.')
  const actor = actors.find((candidate) => candidate.id === answered.actorId)
  const token = base.scene.tokens.find((candidate) => candidate.actorId === answered.actorId)
  if (!actor || !token) throw new Error('Encounter rules input binding mismatch.')
  if (!base.movementTargets.has(actor.id))
    base.movementTargets.set(actor.id, await input.loadTarget(actor))
  const target = await prepareAreaTarget({
    ...input,
    base,
    actor,
    token,
    allyAdvantage: encounterBasicActionAllyAdvantage({ actors, attackerId: base.caster.id })
  })
  refuseLegendaryWindowAction(target.prepared)
  const { economy, attackAction } = await evaluateNativeLiveActionEconomy({
    prepared: target.prepared,
    state,
    actionId: command.actionId,
    sourceTarget: base.casterFacts,
    // The creatures the area first caught, as its sealed saves were prepared with.
    targetIds: [...context.targets.map(({ actorId }) => actorId), ...context.removedActorIds],
    capture
  })
  const maintenance = await prepareNativeLiveActionMaintenance({
    prepared: target.prepared,
    activeEffectsByActorId: input.activeEffectsByActorId,
    capture,
    loadCarriedHolder: async (carrier) =>
      base.movementTargets.get(carrier.id) ?? input.loadTarget(carrier)
  })
  if (
    answered.snapshot.applicationContext.currentnessChecksum !==
    encounterActionCurrentnessChecksum({
      prepared: target.prepared,
      actionEconomy: economy?.consumption ?? null,
      attackAction,
      maintenance,
      sceneContext: target.sceneContext
    })
  )
    throw new Error('The pending action source or target changed.')
  const [tested] = await answerEncounterAreaTest({
    runtime: input.runtime,
    random: input.random,
    adapter: target.prepared.adapter,
    plan: target.prepared.plan,
    occurrenceId: areaSnapshot.occurrenceId,
    target: {
      actorId: actor.id,
      binding: target.prepared.binding,
      autoRoll: { SOURCE: false, TARGET: false }
    },
    tests: [
      {
        actorId: actor.id,
        kind: 'PENDING',
        // An area save is always its target's own roll.
        pending: { ...restoreEncounterActionPending(answered.snapshot), roller: 'TARGET' }
      }
    ],
    resolution
  })
  if (tested?.kind !== 'TESTED') throw new Error('An area save must settle with its answer.')
  return {
    kind: 'AREA_PENDING' as const,
    command,
    response: input.response,
    snapshot: markEncounterAreaSaveTested(
      areaSnapshot,
      resolution.requestId,
      JSON.stringify(resolution)
    ),
    prepared: { actors },
    fingerprint: input.fingerprint,
    initiatorUserId: context.initiatorUserId,
    occurrenceId: areaSnapshot.occurrenceId
  }
}

/** The sealed pending contract the room persists for a point-area action: every caught creature's save. */
export function buildNativeLiveEncounterAreaActionPendingInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Pick<
    | Awaited<ReturnType<typeof planNativeLiveEncounterAreaAction>>
    | Awaited<ReturnType<typeof planNativeLiveEncounterAreaAnswer>>,
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
