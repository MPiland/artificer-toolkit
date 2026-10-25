import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ActiveEffectRepeatTrigger } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { withLinkedDependents } from '../activeEffectLinks.js'
import { listActiveEffectGrants } from '../character/activeEffectGrantTotals.js'
import { encounterActorRelationship } from '../encounterActionTargetPolicy.js'
import { abilityScoreCapabilityRegistry } from '../platformPolicyModules.js'
import { effectHooks } from './effectHooks.js'
import type {
  DamageInterceptionSubscription,
  EncounterEffectHook,
  EncounterEvent,
  EncounterEventSubscription,
  EncounterReactionHook,
  IncomingGateSubscription,
  MaintenanceLinkHook,
  ZoneEventSubscription
} from './encounterEventTable.js'

type HookedEffect = Pick<ActiveRuleEffectRecord, 'id' | 'definition' | 'lifecycle'>

/** The actor an event comes from and the actor whose turn it is; null when there is none. */
export type EffectEventScope = { actorId: string | null; turnActorId: string | null }

/**
 * Whose events an effect meets, and on whose turn, for its grants about attackers and its attack
 * consume: only its Encounter source's when `fromSourceOnly`, and only during its tick anchor's turn
 * while one tick remains when `activeOnlyOnFinalAnchorTurn`; a null field admits anyone. Null while
 * the effect meets no event: dormant before that final turn, or source-only with no source here.
 */
export function effectEventScope(
  effect: HookedEffect,
  holderActorId: string
): EffectEventScope | null {
  const { recurrence, origin } = effect.definition
  const sourceActorId = origin.kind === 'ENCOUNTER' ? origin.sourceActorId : null
  if (recurrence.fromSourceOnly && sourceActorId === null) return null
  const actorId = recurrence.fromSourceOnly ? sourceActorId : null
  if (!recurrence.activeOnlyOnFinalAnchorTurn) return { actorId, turnActorId: null }
  if (recurrence.expiration.kind !== 'TICKS' || effect.lifecycle.remainingTicks !== 1) return null
  return {
    actorId,
    turnActorId:
      recurrence.anchor === 'SOURCE' && sourceActorId !== null ? sourceActorId : holderActorId
  }
}

/** Whether an event falls within an effect's scope (see `effectEventScope`). */
export function isInEffectEventScope(scope: EffectEventScope, event: EffectEventScope): boolean {
  return (
    (scope.actorId === null || scope.actorId === event.actorId) &&
    (scope.turnActorId === null || scope.turnActorId === event.turnActorId)
  )
}

/**
 * Whether damage of these types meets a damage subscription, for an end and a repeat save alike. A
 * damage of unknown type (`null`: a source that dealt several types) meets only an untyped one,
 * since no single type can satisfy a filter.
 */
function damageTriggerMet(
  trigger: { by: 'ANYONE' | 'SOURCE_SIDE'; damageTypeIds: readonly string[] | null },
  input: { onSourceSide: boolean; damageTypeIds: readonly (string | null)[] }
) {
  return (
    (trigger.by === 'ANYONE' || input.onSourceSide) &&
    (trigger.damageTypeIds === null ||
      input.damageTypeIds.some(
        (damageTypeId) => damageTypeId !== null && trigger.damageTypeIds!.includes(damageTypeId)
      ))
  )
}

/**
 * Whether the damage came from the effect source's side: the source itself or an ally of it. Nobody
 * (a null damager or source) is on no side, so only `ANYONE` subscriptions meet such damage.
 */
function damagerOnSourceSide(input: {
  damagerActorId: string | null
  sourceActorId: string | null
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
}) {
  const { damagerActorId, sourceActorId } = input
  return (
    sourceActorId !== null &&
    damagerActorId !== null &&
    (damagerActorId === sourceActorId ||
      encounterActorRelationship(
        input.dispositions.get(damagerActorId) ?? 'NEUTRAL',
        input.dispositions.get(sourceActorId) ?? 'NEUTRAL'
      ) === 'ALLIED')
  )
}

export function sourceActorIdOf({ definition }: HookedEffect) {
  return definition.origin.kind === 'ENCOUNTER' ? definition.origin.sourceActorId : null
}

/**
 * Whether a test spends the effect (D156). A test that adds no dice (`ability: null`, a contest's)
 * never spends a die held for one that does. A test with an ability spends the effect when it has no
 * grants to the subscription's value domain (the test alone ends it) or one of them applies to that
 * ability; a die held for after the roll is spent through the roll's window instead, so the test
 * alone never spends an effect that holds only those.
 */
function testSpends(
  effect: HookedEffect,
  valueDomainCode: string,
  ability: Extract<EncounterEvent, { kind: 'TEST' }>['ability']
) {
  const grants = listActiveEffectGrants([effect])
    .flatMap(({ modifiers }) => modifiers)
    .filter((modifier) => modifier.valueDomainCode === valueDomainCode)
  if (ability === null) return !grants.some(({ modifierKind }) => modifierKind === 'ADD_BONUS_DIE')
  const withRoll = grants.filter(
    ({ payload }) => !(payload && 'timing' in payload && payload.timing === 'AFTER_ROLL')
  )
  if (grants.length > 0 && withRoll.length === 0) return false
  const abilityCode =
    'definitionId' in ability
      ? abilityScoreCapabilityRegistry
          .require(effect.definition.frozenGraph.source.gameSystemId)
          .abilityCode(ability.definitionId)
      : ability.code
  return (
    withRoll.length === 0 ||
    withRoll.some(({ domain }) => domain.ability === undefined || domain.ability === abilityCode)
  )
}

/** The item a grant is bound to (Shillelagh's club); null for an unbound grant. */
function boundItemInstanceId({ definition }: HookedEffect) {
  for (const contribution of definition.stateContributions)
    if (contribution.kind === 'MODIFIER_GRANT' && contribution.boundItem)
      return contribution.boundItem.itemInstanceId
  return null
}

/** `effect` is null for a maintenance link, which has no effect record: effect-bound filters are unmet. */
function subscriptionMet(
  effect: HookedEffect | null,
  subscription: EncounterEventSubscription,
  event: EncounterEvent
): boolean {
  switch (subscription.event) {
    case 'ACTION':
      return (
        event.kind === 'ACTION' &&
        (subscription.fact === null || event[subscription.fact]) &&
        (!subscription.againstEnemyOnly || event.againstEnemy)
      )
    case 'ATTACKED': {
      if (event.kind !== 'ATTACKED' || !effect) return false
      const scope = effectEventScope(effect, event.holderActorId)
      return (
        scope !== null &&
        isInEffectEventScope(scope, {
          actorId: event.attackerActorId,
          turnActorId: event.turnActorId
        })
      )
    }
    case 'TEST':
      return (
        effect !== null &&
        event.kind === 'TEST' &&
        event.test === subscription.test &&
        testSpends(effect, subscription.valueDomainCode, event.ability)
      )
    case 'DAMAGED':
      return (
        event.kind === 'DAMAGED' &&
        event.phase === 'AFTER' &&
        damageTriggerMet(subscription, {
          onSourceSide: damagerOnSourceSide({
            damagerActorId: event.damagerActorId,
            sourceActorId: effect ? sourceActorIdOf(effect) : null,
            dispositions: event.dispositions
          }),
          damageTypeIds: event.damageTypeIds
        })
      )
    case 'INCAPACITATED': {
      if (event.kind !== 'INCAPACITATED' || event.of !== subscription.of) return false
      if (event.of === 'HOLDER') return true
      const sourceActorId = effect ? sourceActorIdOf(effect) : null
      return sourceActorId !== null && event.sourceActorIds.has(sourceActorId)
    }
    case 'CONDITION_HELD':
      return (
        event.kind === 'CONDITION_HELD' &&
        subscription.conditionIds.some((conditionId) => event.conditionIds.includes(conditionId))
      )
    case 'ITEM_RELEASED': {
      if (event.kind !== 'ITEM_RELEASED' || !effect) return false
      const boundItemId = boundItemInstanceId(effect)
      return boundItemId !== null && !event.itemInstanceIdsOnActor.includes(boundItemId)
    }
    case 'ACTION_USED_ON_HOLDER':
      return (
        event.kind === 'ACTION_USED_ON_HOLDER' &&
        subscription.actionDefinitionIds.includes(event.basicActionDefinitionId)
      )
    case 'REST':
      // A rest is the Sheet's event, read there (activeEffectEndsOnRest); no Encounter raises it.
      return false
    case 'SEPARATED':
      // Separation is measured on the Scene by the relationship sweep, not raised as an event.
      return false
    default:
      return event.kind === subscription.event
  }
}

/** An action its holder may react with; its authored reaction trigger is its subscription. */
type ReactionCandidate = Pick<CharacterActionCandidate, 'mechanicFacts'>

/**
 * The hook an event meets in a held reaction: an authored reaction whose trigger the event meets with
 * the qualifiers it adds (a melee attack, an attacker the holder sees, a damage type the hit deals, a
 * cast of a listed spell). A cast reaction answers a cast only by cancelling it. A movement reaction
 * meets none here: the movement path discovers it from the reach it is moved through.
 */
function reactionHookMet(
  { mechanicFacts: { invocation, outcomes } }: ReactionCandidate,
  event: EncounterEvent
): EncounterReactionHook | null {
  const trigger = invocation.reactionTrigger
  if (invocation.activation?.code !== 'REACTION' || !trigger) return null
  switch (trigger.kind) {
    case 'ATTACKED_SELF':
      return event.kind === 'HIT_BY_ATTACK' &&
        (trigger.attackRange !== 'MELEE' || event.melee) &&
        (!trigger.requiresSight || event.attackerSeen)
        ? { event: event.kind, trigger: trigger.kind, triggerDamageTypeIds: [] }
        : null
    case 'DAMAGE_TAKEN': {
      if (event.kind !== 'HIT_BY_ATTACK') return null
      const triggerDamageTypeIds = trigger.damageTypeIds.filter((damageTypeId) =>
        event.damageTypeIds.has(damageTypeId)
      )
      return triggerDamageTypeIds.length > 0
        ? { event: event.kind, trigger: trigger.kind, triggerDamageTypeIds }
        : null
    }
    case 'SPELL_CAST':
      return event.kind === 'SPELL_CAST_BY_OTHER' &&
        outcomes.some(
          (outcome) => outcome.kind === 'EFFECT' && outcome.effectKind === 'CANCEL_TRIGGERING_EVENT'
        )
        ? { event: event.kind, trigger: trigger.kind }
        : null
    case 'TARGETED_SELF':
      return event.kind === 'TARGETED_BY_CAST' &&
        (!trigger.sourceEffectIds?.length || trigger.sourceEffectIds.includes(event.castOwnerId))
        ? { event: event.kind, trigger: trigger.kind }
        : null
    case 'MOVEMENT':
      return null
  }
}

/** A passive feature's subscription to its holder's damage: a grant it gives itself (see `targetEndedEffects`). */
type DamageGrantSubscription = { damageTypeIds: readonly string[] }

/**
 * Whether a damage interception intercepts the event: a kill it negates, or a blow about to drop its
 * holder to 0 that its exclusions and damage cap admit.
 */
function damageInterceptionMet(
  { negatesKill, excludes, maxDamageTaken }: DamageInterceptionSubscription,
  event: EncounterEvent
) {
  if (event.kind === 'KILLED') return negatesKill
  return (
    event.kind === 'DAMAGED' &&
    event.phase === 'BEFORE' &&
    event.hitPoints.before > 0 &&
    event.hitPoints.after === 0 &&
    (maxDamageTaken === undefined || event.damageTaken <= maxDamageTaken) &&
    !(excludes?.critical && event.critical) &&
    !(event.damageTypeId !== null && excludes?.damageTypeIds.includes(event.damageTypeId))
  )
}

/** Whether an incoming gate intercepts the event: a harmful action by an attacker of a type it lists. */
function incomingGateMet({ payload }: IncomingGateSubscription, event: EncounterEvent) {
  const listed = payload.attackerCreatureTypeIds
  return (
    event.kind === 'HARMFUL_ACTION_AIMED' &&
    (listed === undefined ||
      (event.attackerCreatureTypeId !== null && listed.includes(event.attackerCreatureTypeId)))
  )
}

/** Whether a zone acts on the event: a movement, a turn boundary or a melee hit on its source it subscribes to. */
function zoneHookMet(zone: ZoneEventSubscription, event: EncounterEvent) {
  switch (event.kind) {
    case 'ZONE_MOVEMENT':
      return zone.triggerModes.includes(event.movement)
    case 'ZONE_TURN':
      return zone.turnTriggers?.includes(event.boundary) ?? false
    case 'ZONE_SOURCE_MELEE_HIT':
      return zone.retaliatesMeleeHits === true
    default:
      return false
  }
}

/**
 * The one discovery entry point for event hooks (ADR 0039 decision 4): what these events, raised on
 * the holder of `effects` and `reactions`, set off. `ended` are the effects one of whose `END`
 * subscriptions an event meets, in held order, each once however many events it meets (a spell attack
 * is an attack roll and a cast). `repeatSaves` are the effects a `DAMAGED` event makes repeat their
 * save, with the first repeat trigger met. `grants` are the passive damage grants a `DAMAGED` event of
 * their types meets. `reactions` are the held reactions an event offers, in held order, each once
 * with the first hook met; whether one is affordable is decided when it is prepared.
 * `damageInterceptions` and `incomingGates` are the held intercepts an event meets before it resolves,
 * in the order given (their spend order); the caller spends the first. `zones` are the zones a
 * creature's contact event (a `ZONE_*` event) sets off, in the order given.
 */
export function discoverEncounterEventHooks<
  Event extends EncounterEvent,
  Effect extends HookedEffect = HookedEffect,
  Grant extends DamageGrantSubscription = never,
  Reaction extends ReactionCandidate = never,
  Interception extends DamageInterceptionSubscription = never,
  Gate extends IncomingGateSubscription = never,
  Zone extends ZoneEventSubscription = never
>(input: {
  effects?: readonly Effect[]
  zones?: readonly Zone[]
  reactions?: readonly Reaction[]
  damageInterceptions?: readonly Interception[]
  incomingGates?: readonly Gate[]
  maintenanceHooks?: readonly MaintenanceLinkHook[]
  events: readonly Event[]
  grantSubscriptions?: readonly Grant[]
}) {
  const endedByEvent: Effect[] = []
  const repeatSaves: { effect: Effect; trigger: ActiveEffectRepeatTrigger }[] = []
  for (const effect of input.effects ?? []) {
    const hooks: readonly EncounterEffectHook[] = effectHooks(effect)
    const met = (hook: EncounterEffectHook) =>
      input.events.some((event) => subscriptionMet(effect, hook.subscription, event))
    if (hooks.some((hook) => hook.hook === 'END' && met(hook))) endedByEvent.push(effect)
    const repeat = hooks.find((hook) => hook.hook === 'REPEAT_SAVE' && met(hook))
    if (repeat?.hook === 'REPEAT_SAVE') repeatSaves.push({ effect, trigger: repeat.trigger })
  }
  // An effect linked to an ended one ends with it (D172).
  const ended = withLinkedDependents(endedByEvent, input.effects ?? [])
  const damageTypeIds = input.events.flatMap((event) =>
    event.kind === 'DAMAGED' && event.phase === 'AFTER' ? event.damageTypeIds : []
  )
  const grants = (input.grantSubscriptions ?? []).filter((grant) =>
    damageTypeIds.some(
      (damageTypeId) => damageTypeId !== null && grant.damageTypeIds.includes(damageTypeId)
    )
  )
  const reactions = (input.reactions ?? []).flatMap((reaction) => {
    for (const event of input.events) {
      const hook = reactionHookMet(reaction, event)
      // The hook's event is one of `events`, so it is the variant of one of their kinds.
      if (hook)
        return [{ ...(hook as Extract<EncounterReactionHook, { event: Event['kind'] }>), reaction }]
    }
    return []
  })
  const damageInterceptions = (input.damageInterceptions ?? []).filter((interception) =>
    input.events.some((event) => damageInterceptionMet(interception, event))
  )
  const incomingGates = (input.incomingGates ?? []).filter((gate) =>
    input.events.some((event) => incomingGateMet(gate, event))
  )
  const zones = (input.zones ?? []).filter((zone) =>
    input.events.some((event) => zoneHookMet(zone, event))
  )
  // A maintenance link has no effect record, so its hooks meet an event with no effect scope.
  const maintenance = input.maintenanceHooks ?? []
  const maintenanceMet = (hook: MaintenanceLinkHook) =>
    input.events.some((event) => subscriptionMet(null, hook.subscription, event))
  const maintenanceBreak = maintenance.find((hook) => hook.hook === 'BREAK' && maintenanceMet(hook))
  const maintenanceSave = maintenance.some((hook) => hook.hook === 'SAVE' && maintenanceMet(hook))
  return {
    ended,
    repeatSaves,
    grants,
    reactions,
    damageInterceptions,
    incomingGates,
    zones,
    maintenanceBreakReason: maintenanceBreak?.hook === 'BREAK' ? maintenanceBreak.reason : null,
    maintenanceSave
  }
}
