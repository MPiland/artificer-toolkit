import type {
  ResolveEncounterActionInputDto,
  ResolveEncounterActionTargetDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  encounterActionSuppressedWarning,
  evaluateEncounterActorsRuleWarnings,
  RULE_WARNINGS_MESSAGE
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { snapshotCreatureTypeId } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { chosenCreaturesMaxTargets } from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import { catchEncounterAreaActorIds } from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import { encounterChosenActorsChecksum } from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { executeEncounterActorsAction } from '@artificer-toolkit/rules-runtime/encounterActorsActionExecution'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import { refuseActionOutsideItsWindow } from './nativeEncounterActionInputs.js'
import {
  completeAreaCommit,
  prepareAreaScene,
  prepareCasterActionOnTarget,
  prepareCasterSource,
  refuseAreaEffectOutcomes,
  type AreaPlanBase
} from './nativeEncounterAreaRules.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'

type ActorsTarget = Extract<ResolveEncounterActionTargetDto, { kind: 'ACTORS' }>
type ActorsCommand = Omit<ResolveEncounterActionInputDto, 'target'> & { target: ActorsTarget }

const refusal = (message: string) =>
  new LiveSessionDomainRejectionError(422, {
    code: 'DOMAIN_REJECTED',
    reason: 'TARGET_UNAVAILABLE',
    message
  })

/**
 * Plans a cast on a list of chosen creatures (Mass Healing Word, Mass Cure Wounds) as one commit:
 * the creatures are checked against the action's authored cap, the area it names (a point picked
 * within range, every chosen creature inside it) and the single-target rules one by one, the
 * action's outcome runs on each from dice rolled once, and the caster spends once. Nothing waits
 * for anyone, so the root and every creature's child commit together (D118).
 */
export async function planNativeLiveEncounterActorsAction(
  input: AreaPlanBase & { command: ActorsCommand }
) {
  const { command, state, actors, capture } = input
  const sourced = await prepareCasterSource(input, 'ACTORS')
  const { caster, casterFacts, movementTargets, targetPolicy } = sourced
  const { targeting } = targetPolicy
  const maxTargets =
    targeting?.selectionKind === 'CHOSEN_CREATURES' ? chosenCreaturesMaxTargets(targeting) : null
  if (maxTargets === null) throw refusal('This action does not take that target.')
  const { actorIds, scene: sceneRequest } = command.target
  if (actorIds.length > maxTargets)
    throw refusal(`This action takes at most ${maxTargets} creatures.`)
  // Each entry of a projectile list is one projectile; any other action names each creature once.
  const allowRepeatedTargets =
    targeting?.selectionKind === 'CHOSEN_CREATURES' && targeting.allowRepeatedTargets === true
  if (
    !allowRepeatedTargets &&
    new Set(actorIds.map((actorId) => actorId.toLowerCase())).size !== actorIds.length
  )
    throw refusal('This action names each creature once.')
  // An action that names an area is aimed at a point on the Scene; any other takes none.
  const shaped = targetPolicy.shape !== null
  if (shaped !== (sceneRequest?.point != null))
    throw refusal(
      shaped ? 'This action needs a point on the Scene.' : 'This action takes no point.'
    )

  // Positions are read only when the caster saw the Scene; without them range is unchecked.
  let scene = null
  let area = null
  if (shaped && sceneRequest?.point) {
    area = await prepareAreaScene(
      {
        ...input,
        command: {
          ...command,
          target: {
            kind: 'POINT',
            sceneId: sceneRequest.sceneId,
            expectedSceneVersion: sceneRequest.expectedSceneVersion,
            point: sceneRequest.point
          }
        }
      },
      sourced
    )
    scene = { ...area.scene, grid: area.grid }
    const caught = new Set(
      catchEncounterAreaActorIds({
        origin: area.origin,
        shape: area.area.shape,
        casterActorId: caster.id,
        tokens: scene.tokens.map((token) => ({ ...token, id: token.tokenId })),
        fromCasterSpace: false
      })
    )
    if (actorIds.some((actorId) => !caught.has(actorId)))
      throw refusal('A chosen creature is not inside the area.')
  } else if (sceneRequest) {
    const captured = await capture({
      kind: 'ACTION_AREA_SCENE',
      command: {
        actorId: command.actorId,
        sceneId: sceneRequest.sceneId,
        expectedSceneVersion: sceneRequest.expectedSceneVersion
      }
    })
    if (captured.kind !== 'ACTION_AREA_SCENE')
      throw new Error('Action Scene context is unavailable.')
    scene = {
      ...captured.context,
      grid: encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
        encounter: state,
        sceneGrid: captured.context.sceneGrid
      })
    }
  }

  const chosen = actorIds.map((actorId) => {
    const actor = actors.find((candidate) => candidate.id === actorId)
    if (!actor) throw new Error('Encounter rules input binding mismatch.')
    return actor
  })
  for (const actor of chosen)
    if (!movementTargets.has(actor.id)) movementTargets.set(actor.id, await input.loadTarget(actor))
  const prepared = []
  for (const actor of chosen) {
    const token = scene?.tokens.find((candidate) => candidate.actorId === actor.id)
    const sceneContext =
      scene && token
        ? {
            sceneId: scene.sceneId,
            sceneVersion: scene.sceneVersion,
            sourceToken: scene.sourceToken,
            targetToken: token,
            grid: scene.grid
          }
        : null
    prepared.push({
      actor,
      sceneContext,
      prepared: await prepareCasterActionOnTarget(input, {
        caster,
        target: actor,
        movementTargets,
        sceneContext
      })
    })
  }
  const lead = prepared[0]!.prepared
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')
  refuseActionOutsideItsWindow(lead)
  for (const entry of prepared) refuseAreaEffectOutcomes(entry.prepared)
  if (lead.plan.kind !== 'SINGLE_GRAPH') throw refusal('This action does not take that target.')

  const evaluation = await evaluateNativeLiveActionEconomy({
    prepared: lead,
    state,
    actionId: command.actionId,
    sourceTarget: casterFacts,
    targetIds: actorIds,
    capture
  })
  const { activationCode, economy, suppressed, attackAction } = evaluation
  const deadCharacterIds = deadCharacterIdsOfTargets(movementTargets.values())
  const ruleWarnings = evaluateEncounterActorsRuleWarnings({
    preparedWarnings: suppressed
      ? [...lead.ruleWarnings, encounterActionSuppressedWarning(activationCode)]
      : lead.ruleWarnings,
    targets: prepared.map(({ prepared: entry, sceneContext }) => ({
      target: {
        actor: entry.actor,
        target: entry.target,
        targetPolicy: entry.targetPolicy,
        makesAttackRoll: entry.makesAttackRoll,
        sceneContext
      },
      targetDefeated: isEncounterActorDefeated(entry.target, deadCharacterIds),
      targetCreatureTypeId: snapshotCreatureTypeId(entry.target)
    })),
    areaWarnings: area?.area.warnings ?? [],
    actionEconomy: economy,
    activationCode,
    acknowledged: command.acknowledgedWarnings
  })
  if (ruleWarnings.kind === 'UNSUPPORTED_TARGET')
    throw refusal('The selected action does not permit this target.')
  if (ruleWarnings.kind === 'UNACKNOWLEDGED')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: RULE_WARNINGS_MESSAGE,
      warnings: ruleWarnings.warnings
    })

  const occurrenceId = crypto.randomUUID()
  const settled = await executeEncounterActorsAction({
    runtime: input.runtime,
    random: input.random,
    adapter: lead.adapter,
    plan: lead.plan,
    occurrenceId,
    rollsPerTarget: allowRepeatedTargets,
    targets: prepared.map(({ actor, prepared: entry }) => ({
      actorId: actor.id,
      binding: entry.binding
    }))
  })
  return completeAreaCommit({
    input,
    command,
    caster,
    movementTargets,
    kept: prepared.map(({ actor, prepared: entry }) => ({ actor, target: { prepared: entry } })),
    lead,
    ruleOverrides: ruleWarnings.overrides,
    actionEconomy: economy?.consumption ?? null,
    attackAction,
    settled,
    rollsPerTarget: allowRepeatedTargets,
    tests: [],
    audits: new Map(),
    areaOccurrenceId: occurrenceId,
    areaSnapshot: null,
    caughtChecksum: encounterChosenActorsChecksum(actorIds),
    removedActorIds: [],
    placement: null,
    occurrenceVersion: 0,
    response: null,
    removal: null
  })
}
