import type {
  ResolveEncounterActionInputDto,
  ResolveEncounterActionTargetDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { chosenCreaturesMaxTargets } from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import { catchEncounterAreaActorIds } from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import { encounterChosenActorsChecksum } from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { executeEncounterActorsAction } from '@artificer-toolkit/rules-runtime/encounterActorsActionExecution'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import { refuseActionOutsideItsWindow } from './nativeEncounterActionInputs.js'
import {
  completeAreaCommit,
  prepareAreaTarget,
  prepareCasterSource,
  prepareChosenActorsReach,
  reachRuleOverrides,
  sealReachSaves,
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
 * for anyone, so the root and every creature's child commit together (D118). An action that asks
 * each creature for a save (Acid Splash, Chain Lightning) instead seals one save per creature and
 * pends on its rollers like a point area.
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

  const reach = await prepareChosenActorsReach(input, sourced)
  if (reach.scene && reach.area) {
    const caught = new Set(
      catchEncounterAreaActorIds({
        origin: reach.area.origin,
        shape: reach.area.shape,
        casterActorId: caster.id,
        tokens: reach.scene.tokens.map((token) => ({ ...token, id: token.tokenId })),
        fromCasterSpace: false
      })
    )
    if (actorIds.some((actorId) => !caught.has(actorId)))
      throw refusal('A chosen creature is not inside the area.')
  }

  const chosen = actorIds.map((actorId) => {
    const actor = actors.find((candidate) => candidate.id === actorId)
    if (!actor) throw new Error('Encounter rules input binding mismatch.')
    return actor
  })
  for (const actor of chosen)
    if (!movementTargets.has(actor.id)) movementTargets.set(actor.id, await input.loadTarget(actor))
  const prepared = []
  for (const actor of chosen)
    prepared.push({
      actor,
      // The caster named each creature, so none is hidden from them.
      perceivedByCaster: true,
      ...(await prepareAreaTarget({
        ...input,
        base: reach,
        actor,
        token: reach.scene?.tokens.find((candidate) => candidate.actorId === actor.id) ?? null
      }))
    })
  const lead = prepared[0]!.prepared
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')
  refuseActionOutsideItsWindow(lead)

  const evaluation = await evaluateNativeLiveActionEconomy({
    prepared: lead,
    state,
    actionId: command.actionId,
    sourceTarget: casterFacts,
    targetIds: actorIds,
    capture
  })
  const ruleOverrides = reachRuleOverrides({
    command,
    lead,
    evaluation,
    areaWarnings: reach.area?.warnings ?? [],
    targets: prepared,
    movementTargets
  })
  // An action that asks each creature for a save waits for the rollers it names.
  if (lead.plan.kind !== 'SINGLE_GRAPH')
    return sealReachSaves(input, { reach, lead, targets: prepared, evaluation, ruleOverrides })
  const { economy, attackAction } = evaluation

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
    ruleOverrides,
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
