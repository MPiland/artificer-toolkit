import type {
  ResolveEncounterActionInputDto,
  ResolveEncounterActionTargetDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  dividedHealOf,
  refuseHealShares
} from '@artificer-toolkit/rules-runtime/character/characterChosenSpend'
import { chosenCreaturesCap } from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import { encounterFacingRule } from '@artificer-toolkit/rules-runtime/encounterFacing'
import {
  absentEncounterActorIds,
  catchEncounterAreaActorIds
} from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import {
  encounterAreaTargetCommandId,
  encounterAreaTargetOccurrenceId,
  encounterChosenActorsChecksum
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { executeEncounterActorsAction } from '@artificer-toolkit/rules-runtime/encounterActorsActionExecution'
import { encounterSourceImmunityLabel } from '@artificer-toolkit/rules-runtime/encounterSourceImmunity'
import { encounterSpellSchoolImmunity } from '@artificer-toolkit/rules-runtime/encounterSpellSchoolImmunity'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import { applyNativeReactionEffect } from './nativeEncounterAttackReaction.js'
import { refuseActionOutsideItsWindow } from './nativeEncounterActionInputs.js'
import { readChosenFormCreature, sealReachSaves } from './nativeEncounterAreaRules.js'
import { completeAreaCommit } from './nativeAreaCommit.js'
import {
  openReachCastWindow,
  prepareAreaTarget,
  prepareCasterSource,
  prepareChosenActorsReach,
  reachRuleOverrides,
  type AreaPlanBase
} from './nativeAreaPreparation.js'
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
  const cap = targeting?.selectionKind === 'CHOSEN_CREATURES' ? chosenCreaturesCap(targeting) : null
  if (cap === null) throw refusal('This action does not take that target.')
  const { actorIds, scene: sceneRequest } = command.target
  if (cap.maxTargets !== undefined && actorIds.length > cap.maxTargets)
    throw refusal(`This action takes at most ${cap.maxTargets} creatures.`)
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
        fromCasterSpace: false,
        absentActorIds: absentEncounterActorIds(actors)
      })
    )
    if (actorIds.some((actorId) => !caught.has(actorId)))
      throw refusal('A chosen creature is not inside the area.')
  }

  const chosen = actorIds.map((actorId) => {
    const actor = actors.find((candidate) => candidate.id === actorId)
    if (!actor) throw new Error('Encounter rules input binding mismatch.')
    // A named creature immune to this source's use of the action (D156) is refused, as one target is.
    const immunityLabel = encounterSourceImmunityLabel({
      source: sourced.source,
      holderEffects: input.activeEffectsByActorId.get(actorId) ?? []
    })
    if (immunityLabel !== null) throw refusal(`Immune to ${immunityLabel}`)
    return actor
  })
  for (const actor of chosen)
    if (!movementTargets.has(actor.id)) movementTargets.set(actor.id, await input.loadTarget(actor))
  for (const actor of chosen)
    if (
      encounterSpellSchoolImmunity({
        source: sourced.source,
        sourceFacts: casterFacts,
        target: movementTargets.get(actor.id)!
      })
    )
      throw refusal(`${actor.label} is immune to spells of this school`)
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
  const divided = dividedHealOf(lead.binding.actionMechanic)
  if (divided) {
    const refused = refuseHealShares({
      divided,
      shares: command.target.healShares ?? [],
      targets: chosen.map(({ id, label }) => {
        const target = movementTargets.get(id)!
        return {
          id,
          label,
          currentHitPoints: target.state.current,
          maxHitPoints: target.effectiveMaximumHitPoints
        }
      })
    })
    if (refused) throw refusal(refused)
  }
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')
  refuseActionOutsideItsWindow(lead, command)
  const formCreature = await readChosenFormCreature(input, lead, chosen, movementTargets)

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
    movementTargets,
    facing: encounterFacingRule(state)
  })
  const opened = await openReachCastWindow(input, {
    reach,
    lead,
    // A cast that asks each creature for a save settles on its own rollers; only a one-graph cast
    // lets a chosen creature answer being chosen.
    chosenActorIds: lead.plan.kind === 'SINGLE_GRAPH' ? actorIds : null,
    evaluation,
    ruleOverrides
  })
  if (opened.kind === 'PLAN') return opened.plan
  const { window } = opened
  // An action that asks each creature for a save waits for the rollers it names.
  if (lead.plan.kind !== 'SINGLE_GRAPH')
    return sealReachSaves(input, {
      reach,
      lead,
      targets: prepared,
      unaffectedActorIds: [],
      evaluation,
      ruleOverrides,
      window
    })
  const { economy, attackAction } = evaluation

  // A chosen creature that used a reaction to being chosen (Shield) holds its effect before the cast
  // resolves: its entries are prepared again against the creature as that effect leaves it.
  const failedCounters = await window.pause.planFailedCounters(window.failedCounters)
  const reactionEffects = new Map<
    string,
    Awaited<ReturnType<typeof applyNativeReactionEffect>>['reactionEffect']
  >()
  for (const { receipt, found } of failedCounters) {
    if (receipt.reaction.trigger !== 'TARGETED_SELF') continue
    const reactorId = receipt.reaction.reactorActorId
    const reactor = chosen.find((actor) => actor.id === reactorId)
    const reactorOccurrenceId = encounterAreaTargetOccurrenceId(window.occurrenceId, reactorId)
    if (!reactor) throw new Error('Reaction evidence is stale.')
    const prepareReactor = (reactorTarget: Awaited<ReturnType<typeof input.loadTarget>>) =>
      prepareAreaTarget({
        ...input,
        base: {
          ...reach,
          movementTargets: new Map(reach.movementTargets).set(reactorId, reactorTarget)
        },
        actor: reactor,
        token: reach.scene?.tokens.find((candidate) => candidate.actorId === reactorId) ?? null
      })
    const adjusted: { target?: Parameters<typeof prepareReactor>[0] } = {}
    const applied = await applyNativeReactionEffect({
      reaction: { prepared: found.prepared, triggerDamageTypeIds: [] },
      runtime: input.runtime,
      // The effect lands with the reactor's first outcome, so it is that outcome's own.
      occurrenceId: reactorOccurrenceId,
      commandId: encounterAreaTargetCommandId(reactorOccurrenceId),
      reactorActorId: reactorId,
      occurredAt: window.occurredAt,
      activeEffectsByActorId: input.activeEffectsByActorId,
      loadTarget: input.loadTarget,
      prepareAttack: async (_reactedTargets, adjustedTarget) => {
        adjusted.target = adjustedTarget
        return (await prepareReactor(adjustedTarget)).prepared
      }
    })
    if (!adjusted.target) throw new Error('Reaction evidence is stale.')
    reactionEffects.set(reactorId, applied.reactionEffect)
    for (const [index, entry] of prepared.entries())
      if (entry.actor.id === reactorId)
        prepared[index] = { ...entry, ...(await prepareReactor(adjusted.target)) }
  }
  const settled = await executeEncounterActorsAction({
    runtime: input.runtime,
    random: input.random,
    adapter: lead.adapter,
    plan: lead.plan,
    occurrenceId: window.occurrenceId,
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
    occurredAt: window.occurredAt,
    failedCounters,
    reactionEffects,
    movementTargets,
    kept: prepared.map(({ actor, prepared: entry }) => ({ actor, target: { prepared: entry } })),
    lead,
    formCreature,
    ruleOverrides,
    actionEconomy: economy?.consumption ?? null,
    attackAction,
    settled,
    rollsPerTarget: allowRepeatedTargets,
    tests: [],
    audits: new Map(),
    areaOccurrenceId: window.occurrenceId,
    areaSnapshot: null,
    caughtChecksum: encounterChosenActorsChecksum(actorIds),
    removedActorIds: [],
    unaffectedActorIds: [],
    placement: null,
    occurrenceVersion: window.occurrenceVersion,
    response: window.response,
    removal: null
  })
}
