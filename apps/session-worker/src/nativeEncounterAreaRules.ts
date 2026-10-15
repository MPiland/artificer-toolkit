import {
  areaActionTargetOrigin,
  type AreaActionTargetDto,
  type RemoveAreaTargetInputDto,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ServerAggregateChoicePendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { restoreEncounterActionPending } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import {
  liveSessionEncounterActionPendingInputSchema,
  liveSessionEncounterAreaCommitInputSchema
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
import {
  encounterActionCurrentnessChecksum,
  prepareEncounterActionMechanics,
  prepareEncounterActionSource
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  encounterActionSuppressedWarning,
  evaluateEncounterAreaRuleWarnings,
  overridesActionEconomy,
  RULE_WARNINGS_MESSAGE
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
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
  evaluateEncounterAreaTargetPolicy,
  evaluateEncounterCasterCenteredAreaTarget,
  evaluateEncounterDirectedAreaTarget
} from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import {
  buildEncounterAreaPendingSnapshot,
  encounterAreaTargetCommandId,
  encounterAreaSettled,
  encounterAreaTargetOccurrenceId,
  markEncounterAreaLegendaryResistanceDecided,
  markEncounterAreaSaveTested,
  removeEncounterAreaTargetFromSnapshot
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { buildEncounterActionPendingSnapshot } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { refuseStaleCharacterAction } from '@artificer-toolkit/encounter-persistence/staleCharacterAction'
import {
  encounterActiveEffectPlan,
  prepareNativeActionEffectsPlan
} from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import {
  planNativeEncounterActionMechanics,
  planNativeEncounterAreaSourceSpend
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import {
  buildEncounterActionStoredExecution,
  buildEncounterAreaStoredExecution
} from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { planEncounterPlacedZone } from '@artificer-toolkit/rules-runtime/encounterPlacedZone'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { projectEncounterActionTarget } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import { applyEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import { withFeatureChargeUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
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
  readNativeLivePointSight
} from './nativeAttackPerception.js'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import {
  nativeLiveRelationshipFacts,
  refuseLegendaryWindowAction,
  refuseSpatialInterpretation
} from './nativeEncounterActionInputs.js'
import { planNativeLiveConcentration } from './nativeEncounterConcentration.js'
import { prepareNativeLiveActionMaintenance } from './nativeEncounterMaintenance.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'

type AreaCommand = Omit<ResolveEncounterActionInputDto, 'target'> & {
  target: AreaActionTargetDto
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
  /** Whether the roller who answers this creature's save has "Auto-roll my dice" on. */
  requireAutoRoll: (actorId: string) => boolean
  /** Each actor's roller preference, for the Concentration checks the area's damage asks for. */
  autoRollByActorId: Readonly<Record<string, boolean>>
}

/** Why a directed area is refused, as the player is told. */
const DIRECTED_AREA_REFUSALS = {
  UNSUPPORTED_AREA: "This action's area size is not supported.",
  NO_CASTER_TOKEN: 'The caster has no token on the map.',
  ORIGIN_OFF_CASTER: 'This area cannot extend from there.'
} as const

/** What every creature of one area shares: the caster, the Scene the point was picked in, and the area. */
async function prepareAreaScene(input: AreaPlanInput) {
  const { command, state, actors, capture } = input
  const caster = actors.find((actor) => actor.id === command.actorId)
  if (!caster) throw new Error('Encounter rules input binding mismatch.')
  const casterFacts = await input.loadTarget(caster)
  const movementTargets = new Map([[caster.id, casterFacts]])
  const { source, targetPolicy } = await prepareEncounterActionSource({
    state,
    actor: caster,
    actionId: command.actionId,
    sourceFacts: casterFacts,
    loadSource: async (source) => resolveEncounterActionSource({ ...source, system: input.system })
  }).catch(refuseStaleCharacterAction)
  // An area action takes the target its policy names (a point or a direction from the caster); any
  // other action names a creature instead.
  if (encounterActionTargetKind(targetPolicy) !== command.target.kind)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'This action does not take that target.'
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
  const { target } = command
  const area =
    target.kind === 'CASTER_CENTERED'
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
        : evaluateEncounterAreaTargetPolicy({
            targetPolicy,
            point: target.point,
            grid,
            sourceToken: scene.sourceToken,
            pointSeen:
              (await readNativeLivePointSight({
                state,
                system: input.system,
                observer: casterFacts,
                point: target.point,
                sceneContext: { sceneId: scene.sceneId, sceneVersion: scene.sceneVersion, grid },
                capture
              })) === 'SEES'
          })
  if (!area) throw new Error('The selected action area is not supported.')
  if ('refusal' in area)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: DIRECTED_AREA_REFUSALS[area.refusal]
    })
  const origin =
    target.kind === 'CASTER_CENTERED' ? scene.sourceToken?.position : areaActionTargetOrigin(target)
  if (!origin) throw new Error('A caster-centered area needs the caster’s token.')
  // An action that places a zone leaves it at the picked point instead of putting anyone through it.
  const zone =
    source.kind === 'CHARACTER_ACTION' && source.entry.schemaVersion === 4
      ? source.entry.compilation.zonePlacement
      : null
  return { caster, casterFacts, movementTargets, scene, grid, area, origin, zone }
}

/** One creature's action mechanics against the point's Scene, as its sealed save was prepared. */
async function prepareAreaTarget(
  input: AreaPlanInput & {
    base: Awaited<ReturnType<typeof prepareAreaScene>>
    actor: EncounterRunActorState
    token: Awaited<ReturnType<typeof prepareAreaScene>>['scene']['tokens'][number]
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
      wieldConflictAcceptance: {
        kind: 'PROMPTED',
        accepted: command.acceptedWieldConflict
      },
      overridable: true,
      movementTargets: base.movementTargets,
      sceneContext,
      loadSource: async (source) =>
        resolveEncounterActionSource({ ...source, system: input.system }),
      loadRelationshipFacts: nativeLiveRelationshipFacts({
        activeEffectsByActorId: input.activeEffectsByActorId
      })
    }).catch(refuseStaleCharacterAction)
  }
}

/**
 * The caster's own preparation of the action, which an area that keeps no creature is checked and
 * spent against: the action's source, plan and economy do not depend on whom the area catches.
 */
function prepareAreaCaster(
  input: AreaPlanInput,
  base: Awaited<ReturnType<typeof prepareAreaScene>>
) {
  return prepareAreaTarget({
    ...input,
    base,
    actor: base.caster,
    token: base.scene.sourceToken
  })
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

  // A zone is entered later, by movement; placing it puts nobody through its save.
  const caughtActorIds = base.zone
    ? []
    : catchEncounterAreaActorIds({
        origin: base.origin,
        shape: area.shape,
        casterActorId: caster.id,
        tokens: scene.tokens.map((token) => ({ ...token, id: token.tokenId })),
        fromCasterSpace: command.target.kind === 'CASTER_CENTERED'
      })
  const caught = caughtActorIds.map((actorId) => {
    const actor = actors.find((candidate) => candidate.id === actorId)
    const token = scene.tokens.find((candidate) => candidate.actorId === actorId)
    if (!actor || !token) throw new Error('Encounter rules input binding mismatch.')
    return { actor, token }
  })
  for (const { actor } of caught)
    if (!movementTargets.has(actor.id)) movementTargets.set(actor.id, await input.loadTarget(actor))

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
            sceneContext: { sceneId: scene.sceneId, sceneVersion: scene.sceneVersion, grid },
            capture
          })
        ).actual.attackerSeesTarget === 'SEES')
    )
      perceivedByCaster.add(actor.id)
  }

  const preparedTargets = []
  for (const { actor, token } of caught)
    preparedTargets.push(await prepareAreaTarget({ ...input, base, actor, token }))
  // An area that catches nobody still spends the action: its checks run against the caster's own
  // preparation of it.
  const lead = preparedTargets[0] ?? (await prepareAreaCaster(input, base))
  refuseLegendaryWindowAction(lead.prepared)
  refuseAreaEffectOutcomes(lead.prepared)
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')

  const evaluation = await evaluateNativeLiveActionEconomy({
    prepared: lead.prepared,
    state,
    actionId: command.actionId,
    sourceTarget: casterFacts,
    targetIds: caughtActorIds,
    capture
  })
  const { economy, attackAction } = evaluation
  const ruleOverrides = areaRuleOverrides({
    prepared: lead.prepared,
    area,
    evaluation,
    command
  })
  const actionEconomy = economy?.consumption ?? null
  const maintenance = await prepareNativeLiveActionMaintenance({
    prepared: lead.prepared,
    activeEffectsByActorId: input.activeEffectsByActorId,
    capture,
    loadCarriedHolder: async (actor) => movementTargets.get(actor.id) ?? input.loadTarget(actor)
  })

  const occurrenceId = crypto.randomUUID()
  const tests = await prepareEncounterAreaTests({
    runtime: input.runtime,
    random: input.random,
    adapter: lead.prepared.adapter,
    plan: lead.prepared.plan,
    occurrenceId,
    targets: preparedTargets.map(({ prepared }) => ({
      actorId: prepared.target.id,
      binding: prepared.binding,
      autoRoll: { SOURCE: false, TARGET: false },
      discoverLegendaryResistance: discoverNativeLegendaryResistance(input, prepared)
    }))
  })
  const commandJson = JSON.stringify(command)
  const initiatorUserId = input.initial.expectedUserId
  const targets = preparedTargets.map(({ prepared, token, sceneContext }) => {
    const test = tests.find((candidate) => candidate.actorId === prepared.target.id)
    if (test?.kind !== 'PENDING') throw new Error('An area save must wait for its roller.')
    return {
      actorId: prepared.target.id,
      perceivedByCaster: perceivedByCaster.has(prepared.target.id),
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
  let snapshot = buildEncounterAreaPendingSnapshot({
    occurrenceId,
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
    commandJson,
    commandFingerprint: input.fingerprint,
    initiatorUserId,
    casterActorId: caster.id,
    placesZone: base.zone !== null,
    scene: { sceneId: scene.sceneId, sceneVersion: scene.sceneVersion },
    area: { origin: base.origin, shape: area.shape },
    targets
  })
  // A creature whose roller auto-rolls has its save rolled now, so an auto-rolled failure opens its
  // Legendary Resistance choice. It is kept as the dice it rolled, which replay without rolling again.
  for (const [index, target] of targets.entries()) {
    if (!input.requireAutoRoll(target.actorId)) continue
    const requestId = target.snapshot.request.requestId
    const tested = await replayAreaTargetSave(
      input,
      { actor: caught[index]!.actor, target: preparedTargets[index]! },
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
        targetStateChecksum: checksumRuleDocument(preparedTargets[index]!.prepared.target)
      })
    )
  }
  if (encounterAreaSettled(snapshot))
    return planNativeLiveEncounterAreaCommit({
      ...input,
      response: null,
      areaSnapshot: snapshot
    })
  return {
    kind: 'AREA_PENDING' as const,
    command,
    response: null,
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
  input: AreaPlanInput & {
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
      encounterAreaTargetOccurrenceId(areaSnapshot.occurrenceId, answered.actorId) ||
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
  input: AreaPlanInput & {
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
  input: AreaPlanInput,
  context: AreaContext,
  sealed: AreaTargetRecord,
  scene?: Awaited<ReturnType<typeof prepareAreaScene>>
) {
  const { command, state, actors, capture } = input
  const base = scene ?? (await prepareAreaScene(input))
  if (
    base.scene.sceneVersion !== context.scene.sceneVersion ||
    checksumCanonicalJson(base.area.shape) !== checksumCanonicalJson(context.area.shape)
  )
    throw new Error('The pending area changed.')
  const actor = actors.find((candidate) => candidate.id === sealed.actorId)
  const token = base.scene.tokens.find((candidate) => candidate.actorId === sealed.actorId)
  if (!actor || !token || sealed.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION')
    throw new Error('Encounter rules input binding mismatch.')
  if (!base.movementTargets.has(actor.id))
    base.movementTargets.set(actor.id, await input.loadTarget(actor))
  const target = await prepareAreaTarget({
    ...input,
    base,
    actor,
    token
  })
  refuseLegendaryWindowAction(target.prepared)
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

/** Runs one creature's sealed save with its answer; an area save is always its target's own roll. */
async function replayAreaTargetSave(
  input: AreaPlanInput,
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
      binding: target.prepared.binding,
      autoRoll: { SOURCE: false, TARGET: false },
      discoverLegendaryResistance: discoverNativeLegendaryResistance(input, target.prepared)
    },
    tests: [
      {
        actorId: actor.id,
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

/**
 * Refuses an area outcome that would leave anything behind on a creature: a condition, a lasting or
 * recurring effect, or a maintained effect. An area commits each creature's damage and nothing else
 * yet. Without `effects` it checks the action's effect plan (at open); with them, what the settled
 * outcome actually produced (at commit).
 */
function refuseAreaEffectOutcomes(
  prepared: AreaPrepared,
  effects?: {
    stateEffect: unknown
    recurringEffect: unknown
    relationshipConditionApplications: readonly unknown[]
    maintenance: unknown
  }
) {
  const leavesEffect = effects
    ? effects.stateEffect !== null ||
      effects.recurringEffect !== null ||
      effects.relationshipConditionApplications.length > 0 ||
      effects.maintenance !== null
    : encounterActiveEffectPlan(
        prepared,
        prepared.plan.kind === 'SINGLE_GRAPH'
          ? prepared.plan.published
          : prepared.plan.test.published
      ) !== null
  if (leavesEffect)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'Area actions that apply conditions or lasting effects are not supported yet.'
    })
}

/** The warnings an area action raises, refused unless the caster acknowledged them. */
function areaRuleOverrides(input: {
  prepared: AreaPrepared
  area: Awaited<ReturnType<typeof prepareAreaScene>>['area']
  evaluation: Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>
  command: AreaCommand
}) {
  const { activationCode, economy, suppressed } = input.evaluation
  const ruleWarnings = evaluateEncounterAreaRuleWarnings({
    preparedWarnings: suppressed
      ? [...input.prepared.ruleWarnings, encounterActionSuppressedWarning(activationCode)]
      : input.prepared.ruleWarnings,
    areaWarnings: input.area.warnings,
    actionEconomy: economy,
    activationCode,
    acknowledged: input.command.acknowledgedWarnings
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
  input: AreaPlanInput,
  base: Awaited<ReturnType<typeof prepareAreaScene>>,
  removedActorIds: readonly string[]
) {
  const target = await prepareAreaCaster(input, base)
  refuseLegendaryWindowAction(target.prepared)
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
  input: AreaPlanInput & {
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
  input: AreaPlanInput & {
    response: ResolveRuleOccurrenceInputDto | null
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
    /** The GM removal that left nothing to wait on, when it, not an answer, settles the area. */
    removal?: RemoveAreaTargetInputDto
  }
) {
  const { command, state, actors, areaSnapshot } = input
  const context = areaSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_AREA_ACTION')
    throw new Error('The pending area action is unavailable.')
  const areaOccurrenceId = areaSnapshot.occurrenceId
  const base = await prepareAreaScene(input)
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
  const ruleOverrides = areaRuleOverrides({
    prepared: lead,
    area: base.area,
    evaluation: first.evaluation,
    command
  })
  const { economy, attackAction } = first.evaluation
  const actionEconomy = economy?.consumption ?? null

  const tests = []
  for (const entry of kept) {
    if (entry.sealed.testedJson === undefined) throw new Error('The area save is unanswered.')
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
    targets: kept.map(({ target }) => ({
      actorId: target.prepared.target.id,
      binding: target.prepared.binding,
      autoRoll: { SOURCE: false, TARGET: false },
      discoverLegendaryResistance: discoverNativeLegendaryResistance(input, target.prepared)
    })),
    tests,
    legendaryResistance: audits
  })

  const occurredAt = new Date().toISOString()
  const userId = input.initial.expectedUserId
  const children = []
  for (const { actor, target } of kept) {
    const { prepared } = target
    const complete = settled.find((entry) => entry.actorId === actor.id)?.complete
    const test = tests.find((entry) => entry.actorId === actor.id)
    if (!complete || !test) throw new Error('The area outcome is unavailable.')
    const occurrenceId = encounterAreaTargetOccurrenceId(areaOccurrenceId, actor.id)
    const commandId = encounterAreaTargetCommandId(occurrenceId)
    const effects = prepareNativeActionEffectsPlan({
      prepared,
      execution: complete,
      occurrenceId,
      commandId,
      activeEffectsByActorId: input.activeEffectsByActorId
    })
    refuseAreaEffectOutcomes(prepared, effects)
    refuseSpatialInterpretation(prepared, {
      execution: complete.execution,
      occurrenceId,
      published: complete.published,
      targetActorId: actor.id
    })
    // A Character caster caught by their own area spends in the same Sheet write as their outcome.
    const carriesSpend = caster.kind === 'CHARACTER' && actor.id === caster.id
    const mechanics = planNativeEncounterActionMechanics(
      {
        prepared,
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        occurrenceId,
        sourceCommandId: command.commandId,
        commandId,
        occurredAt,
        applications: complete.applications,
        sourceSpend: carriesSpend ? 'WITH_OUTCOME' : 'NONE'
      },
      userId
    )
    const audit = audits.get(actor.id)
    let resistance: ReturnType<typeof encounterTargetLegendaryResistance> | null = null
    if (audit) {
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
      resistance,
      execution: buildEncounterActionStoredExecution({
        prepared,
        execution: complete,
        occurrenceId,
        occurrenceVersion: 0,
        settled: mechanics,
        effects: projectNativeActionEffectTransitions({
          state: null,
          recurring: null,
          targetActorId: actor.id
        }),
        maintainedState: null,
        maintenanceTransition: null,
        actionEconomy: null,
        attackAction: null,
        area: { parentOccurrenceId: areaOccurrenceId },
        resistance
      })
    })
  }

  const merged = children.find((child) => child.carriesSpend)
  const resourceState = lead.characterActionState
  const spends = Boolean(
    resourceState?.resourceConsumption ||
    resourceState?.itemConsumption ||
    resourceState?.spellConsumption ||
    lead.acceptedWieldConflict
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
          occurredAt
        },
        userId
      )
  const spend = merged
    ? {
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
  const resumed = input.response ?? input.removal
  const placedZone = base.zone
    ? planEncounterPlacedZone({
        zone: base.zone,
        id: crypto.randomUUID(),
        encounterId: state.id,
        occurrenceId: areaOccurrenceId,
        rootCommandId: command.commandId,
        sourceActorId: caster.id,
        point: base.origin,
        area: base.area.shape
      })
    : null
  const execution = buildEncounterAreaStoredExecution({
    occurrenceId: areaOccurrenceId,
    occurrenceVersion: resumed ? resumed.expectedOccurrenceVersion + 1 : 0,
    actorId: caster.id,
    sourceCharacterId: caster.kind === 'CHARACTER' ? caster.sourceId : null,
    caughtChecksum: context.caughtChecksum,
    removedActorIds: context.removedActorIds,
    targetOccurrenceIds: children.map((child) => child.occurrenceId),
    placedSpatialEffectId: placedZone?.id ?? null,
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
  const projectedTargets = new Map(
    [...base.movementTargets].map(([actorId, target]) => {
      const actor = settledActors.get(actorId)
      if (!actor) throw new Error('Encounter settlement actor is unavailable.')
      return [
        actorId,
        projectEncounterActionTarget({
          target: {
            ...target,
            activeEffects: input.activeEffectsByActorId.get(actorId) ?? []
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
      actors: actors.map((actor) => settledActors.get(actor.id)!),
      projectedTargets,
      activeEffectsByActorId: input.activeEffectsByActorId,
      maintenanceOwners: [],
      maintainedState: null,
      createdEffects: []
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
    response: input.response,
    removal: input.removal ?? null,
    area: areaSnapshot,
    prepared: { actors },
    occurredAt,
    initialDefinitionId:
      children[0]?.complete.initialPublished.id ??
      (lead.plan.kind === 'SINGLE_GRAPH' ? lead.plan.published.id : lead.plan.test.published.id),
    execution,
    targets: children.map(({ actorId, execution: targetExecution }) => ({
      actorId,
      execution: targetExecution
    })),
    rules,
    resourceConsumption: resourceState?.resourceConsumption ?? null,
    itemConsumption: resourceState?.itemConsumption ?? null,
    spellConsumption: resourceState?.spellConsumption ?? null,
    label: sourceLabel,
    ruleOverrides,
    concentration,
    placedZone
  }
}

/** The completed area and its per-creature child contracts the room persists in one transaction. */
export function buildNativeLiveEncounterAreaCommitInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Awaited<ReturnType<typeof planNativeLiveEncounterAreaCommit>> & {
    revisions: LiveSessionRulesRevisions
  }
) {
  return liveSessionEncounterAreaCommitInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    removal: plan.removal,
    revisions: plan.revisions,
    occurredAt: plan.occurredAt,
    initialDefinitionId: plan.initialDefinitionId,
    execution: plan.execution,
    targets: plan.targets,
    area: plan.area,
    placedZone: plan.placedZone,
    rules: plan.rules,
    resourceConsumption: plan.resourceConsumption,
    itemConsumption: plan.itemConsumption,
    spellConsumption: plan.spellConsumption,
    label: plan.label,
    ruleOverrides: plan.ruleOverrides,
    concentration: plan.concentration.completed,
    pendingConcentration: plan.concentration.pending,
    concentrationEnds: plan.concentration.concentrationEnds,
    endedGrants: plan.concentration.endedGrants
  })
}
