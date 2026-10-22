import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { prepareActiveRuleEffectRecord } from './activeRuleEffectRecords.js'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ServerRuleExecutionD20EvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { ENDED_EFFECT_RELEASE_OPERATION_KEY } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type {
  CharacterEndedEffectReleaseApplication,
  CharacterRuleActionApplication
} from './characterRuleActionSystemAdapter.js'
import { withLinkedDependents } from './activeEffectLinks.js'
import { endedMaintenanceConditions } from './encounterActionMaintenance.js'
import { encounterActorRelationship } from './encounterActionTargetPolicy.js'
import type { prepareRecurringActiveEffect } from './encounterActionEffectPlans.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'
import type { EncounterEvent } from './events/encounterEventTable.js'

/**
 * What event-ended effects release from their holder: the conditions they alone held, then the
 * temporary hit points each owning effect gave (D156). A condition stays when the holder had it
 * before the effect or another effect on the holder still owns it; temporary hit points leave only
 * while the ended effect is still the pool's source, which the holder's fold decides. The holder's
 * mechanics batch applies these in the same transaction as the effects' deletion.
 */
export function endedEffectReleases(input: {
  holderActorId: string
  /** Every effect the holder carries before the event. */
  held: readonly ActiveRuleEffectRecord[]
  ended: readonly ActiveRuleEffectRecord[]
}): CharacterEndedEffectReleaseApplication[] {
  const endedIds = new Set(input.ended.map(({ id }) => id))
  const released = endedMaintenanceConditions(
    input.ended,
    input.held.filter(({ id }) => !endedIds.has(id))
  )
  const conditionReleases = [...released].sort().map((conditionId) => {
    const owner = input.ended.find(({ definition }) =>
      definition.stateContributions.some(
        (contribution) =>
          contribution.kind === 'CONDITION_OWNERSHIP' && contribution.conditionId === conditionId
      )
    )
    if (!owner) throw new Error('An ended effect released a condition it does not own.')
    return {
      kind: 'CONDITION_REMOVE' as const,
      conditionId,
      sourceActiveEffectId: owner.id,
      targetActorId: input.holderActorId,
      sourceNodeId: owner.definition.frozenGraphNodeId,
      sourceOperationKey: ENDED_EFFECT_RELEASE_OPERATION_KEY,
      authoredPath: null,
      resolvedPath: null
    }
  })
  const temporaryReleases = input.ended
    .filter(({ definition }) =>
      definition.stateContributions.some(
        (contribution) => contribution.kind === 'TEMPORARY_HIT_POINTS_OWNERSHIP'
      )
    )
    .map((owner) => ({
      kind: 'TEMPORARY_HIT_POINTS_RELEASE' as const,
      sourceActiveEffectId: owner.id,
      targetActorId: input.holderActorId,
      sourceNodeId: owner.definition.frozenGraphNodeId,
      sourceOperationKey: ENDED_EFFECT_RELEASE_OPERATION_KEY,
      authoredPath: null,
      resolvedPath: null
    }))
  return [...conditionReleases, ...temporaryReleases]
}

/**
 * What an effect's own expiry at a turn boundary releases from its holder: the temporary hit points
 * it gave (D156). Its conditions follow the turn's retained-condition rule instead.
 */
export function expiredEffectReleases(effect: ActiveRuleEffectRecord, holderActorId: string) {
  return endedEffectReleases({ holderActorId, held: [effect], ended: [effect] }).filter(
    (release) => release.kind === 'TEMPORARY_HIT_POINTS_RELEASE'
  )
}

/** Names one ended-effect release, so a persisted plan can be checked against the releases it owes. */
export function endedEffectReleaseKey(
  release:
    | { kind: 'CONDITION_REMOVE'; sourceActiveEffectId?: string; conditionId: string }
    | { kind: 'TEMPORARY_HIT_POINTS_RELEASE'; sourceActiveEffectId: string }
) {
  return release.kind === 'CONDITION_REMOVE'
    ? `${release.sourceActiveEffectId}:${release.conditionId}`
    : `${release.sourceActiveEffectId}:temporary-hit-points`
}

/**
 * The effects a holder's saving throw spends (D156): those whose die applied to a save with this
 * ability (null for a save with none, a death save). The one place the rule lives; an action's
 * saves, a Concentration save and a death save all spend through it.
 */
export function savingThrowSpentEffects(
  held: readonly ActiveRuleEffectRecord[],
  abilityCode: string | null
) {
  return discoverEncounterEventHooks({
    effects: held,
    events: [{ kind: 'TEST', test: 'SAVE', ability: { code: abilityCode } }]
  }).ended
}

/**
 * A timed grant a damaged creature's passive feature gives itself: the effect it would hold, made
 * ahead of the damage, and the damage types that set it off.
 */
export interface IncomingDamageGrantTrigger {
  /** The id the effect takes if the damage sets it off. */
  id: string
  /** The passive feature's Effect; a grant it gave before is refreshed, never stacked. */
  authoredEffectId: string
  damageTypeIds: readonly string[]
  effect: NonNullable<ReturnType<typeof prepareRecurringActiveEffect>>
}

/**
 * The held effects a refreshed damage-trigger grant replaces: those the same passive feature gave
 * before, keyed by `authoredEffectId`. A root that persists the grants from its receipt, where the
 * triggers are no longer at hand, ends exactly what `targetEndedEffects` ended.
 */
export function effectsReplacedByGrants(
  held: readonly ActiveRuleEffectRecord[],
  grants: readonly Pick<ActiveRuleEffectRecord['definition'], 'authoredEffectId'>[]
) {
  return held.filter(({ definition }) =>
    grants.some(({ authoredEffectId }) => authoredEffectId === definition.authoredEffectId)
  )
}

/**
 * The records the grants `targetEndedEffects` returned become on their holder, after the effects it
 * keeps. Every root builds them here so planning and persisting create the same records.
 */
export function incomingDamageGrantRecords(input: {
  grants: ReturnType<typeof targetEndedEffects>['grants']
  owner: ActiveRuleEffectRecord['owner']
  /** The effects the holder carries once the ended ones are gone, plus any this root already made. */
  current: readonly ActiveRuleEffectRecord[]
  occurredAt: string
}) {
  const records: ActiveRuleEffectRecord[] = []
  for (const { id, effect } of input.grants)
    records.push(
      prepareActiveRuleEffectRecord({
        id,
        owner: input.owner,
        definition: effect.definition,
        lifecycle: effect.lifecycle,
        currentEffects: [...input.current, ...records],
        occurredAt: input.occurredAt
      })
    )
  return records
}

/**
 * What an action ends on its target: the effects used up by an attack roll against the holder
 * (`ON_ATTACKED`, after their modifiers applied to that roll), those whose `DAMAGE_TAKEN` end
 * trigger the outcome meets (damage that survives the holder's defenses, of a type the trigger
 * names, by someone the trigger allows), and the conditions only they held. The holder's own
 * mechanics batch applies the releases in the same transaction as the effects' deletion. Damage of a
 * type a passive grantTriggers entry names then gives its grant, replacing the one the same feature
 * gave before; it joins after the ended effects are released, so a grant from this hit stays.
 */
export function targetEndedEffects(input: {
  holderActorId: string
  held: readonly ActiveRuleEffectRecord[]
  /** Whether the action made an attack roll against the holder. */
  attacked: boolean
  /** The d20 evidence the action settled for the holder, whose saving throws spend their dice. */
  testEvidence: readonly (ServerRuleExecutionD20EvidenceDto | null | undefined)[]
  /** The actor whose turn it is, which an effect active only on one turn compares. */
  turnActorId: string | null
  /** The outcome applications this action settles on the holder. */
  applications: readonly CharacterRuleActionApplication[]
  /** Who dealt the damage; null when nobody did, so only `ANYONE` triggers meet it. */
  damagerActorId: string | null
  /** Every Encounter actor's disposition, to tell the effect source's side from the rest. */
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
  /** The grants the holder's passive features give when it takes damage; none when omitted. */
  grantTriggers?: readonly IncomingDamageGrantTrigger[]
}) {
  const dealt = input.applications.flatMap((application) =>
    application.kind === 'DAMAGE' &&
    application.targetActorId === input.holderActorId &&
    application.resolvedAmount > 0
      ? [application.damageTypeId]
      : []
  )
  const events: EncounterEvent[] = [
    // An attack consumes only the effects whose event scope admits the attacker on this turn.
    ...(input.attacked
      ? [
          {
            kind: 'ATTACKED',
            holderActorId: input.holderActorId,
            attackerActorId: input.damagerActorId,
            turnActorId: input.turnActorId
          } as const
        ]
      : []),
    ...input.testEvidence.flatMap((evidence) => {
      const definitionId = evidence?.savingThrowAbilityDefinitionId
      return definitionId === undefined
        ? []
        : [{ kind: 'TEST', test: 'SAVE', ability: { definitionId } } as const]
    }),
    ...(dealt.length > 0
      ? [
          {
            kind: 'DAMAGED',
            phase: 'AFTER',
            damagerActorId: input.damagerActorId,
            damageTypeIds: dealt,
            dispositions: input.dispositions
          } as const
        ]
      : [])
  ]
  const hooks = discoverEncounterEventHooks({
    effects: input.held,
    events,
    grantSubscriptions: input.grantTriggers ?? []
  })
  const replaced = effectsReplacedByGrants(input.held, hooks.grants)
  const endedEffects = input.held.filter(
    (effect) => replaced.includes(effect) || hooks.ended.includes(effect)
  )
  return {
    endedEffects,
    releases: endedEffectReleases({
      holderActorId: input.holderActorId,
      held: input.held,
      ended: endedEffects
    }),
    grants: hooks.grants.map(({ id, effect }) => ({ id, effect }))
  }
}

/**
 * What another creature's action ends on its target: the effects whose `ACTION_USED_ON_HOLDER` end
 * trigger names the basic action used, and the conditions only they held. The holder's own mechanics
 * batch applies the releases in the same transaction as the effects' deletion.
 */
export function actionUsedOnHolderEndedEffects(input: {
  holderActorId: string
  held: readonly ActiveRuleEffectRecord[]
  usedByActorId: string
  basicActionDefinitionId: string
}) {
  const endedEffects =
    input.usedByActorId === input.holderActorId
      ? []
      : discoverEncounterEventHooks({
          effects: input.held,
          events: [
            {
              kind: 'ACTION_USED_ON_HOLDER',
              basicActionDefinitionId: input.basicActionDefinitionId
            }
          ]
        }).ended
  return {
    endedEffects,
    releases: endedEffectReleases({
      holderActorId: input.holderActorId,
      held: input.held,
      ended: endedEffects
    })
  }
}

type EndEffectsSelectors = readonly { kind: 'CONDITION'; conditionIds: readonly string[] }[]

/** The held effects an END_EFFECTS outcome could end: those owning a condition a selector names. */
export function endEffectsCandidates(
  held: readonly ActiveRuleEffectRecord[],
  selectors: EndEffectsSelectors
) {
  const named = new Set(selectors.flatMap(({ conditionIds }) => conditionIds))
  return held.filter(({ definition }) =>
    definition.stateContributions.some(
      (contribution) =>
        contribution.kind === 'CONDITION_OWNERSHIP' && named.has(contribution.conditionId)
    )
  )
}

/**
 * The effect a `ONE_CHOSEN` cast ends: the sole candidate when exactly one matches, else the
 * caster's pick when it is a candidate. `NONE` means nothing matches (the overridable warning);
 * `UNCHOSEN` means several match and the cast named no legal one.
 */
export function endEffectsChoice(
  candidates: readonly ActiveRuleEffectRecord[],
  chosenEffectId: string | undefined
): { kind: 'CHOSEN'; effectId: string } | { kind: 'NONE' } | { kind: 'UNCHOSEN' } {
  if (candidates.length === 0) return { kind: 'NONE' }
  if (candidates.length === 1) return { kind: 'CHOSEN', effectId: candidates[0].id }
  const picked = candidates.find(({ id }) => id === chosenEffectId)
  return picked ? { kind: 'CHOSEN', effectId: picked.id } : { kind: 'UNCHOSEN' }
}

/**
 * What an END_EFFECTS action offers its caster against the target's held effects: the selectors it
 * ends by, the legal list, and the pick a `ONE_CHOSEN` cast resolves to. Nothing is offered for an
 * action that ends no effects.
 */
export function offerEndEffects(input: {
  endEffects: { scope: 'ALL' | 'ONE_CHOSEN'; conditionIds: readonly string[] } | undefined
  held: readonly ActiveRuleEffectRecord[]
  chosenEffectId: string | undefined
}) {
  const selectors: EndEffectsSelectors = [
    { kind: 'CONDITION', conditionIds: input.endEffects?.conditionIds ?? [] }
  ]
  const candidates = input.endEffects ? endEffectsCandidates(input.held, selectors) : []
  const pick =
    input.endEffects?.scope === 'ONE_CHOSEN'
      ? endEffectsChoice(candidates, input.chosenEffectId)
      : null
  return { selectors, candidates, pick }
}

/**
 * What an authored END_EFFECTS outcome ends on its target: the held effects owning a condition a
 * selector names (all of them, or only the chosen one), the effects linked to those (D172), and
 * the conditions only they held. The holder's own mechanics batch applies the releases in the same
 * transaction as the effects' deletion.
 */
export function selectedEndedEffects(input: {
  holderActorId: string
  held: readonly ActiveRuleEffectRecord[]
  selectors: EndEffectsSelectors
  scope: 'ALL' | 'ONE_CHOSEN'
  /** The effect the cast picked; only `ONE_CHOSEN` reads it. */
  chosenEffectId?: string
}) {
  const matching = endEffectsCandidates(input.held, input.selectors)
  const selected =
    input.scope === 'ALL' ? matching : matching.filter(({ id }) => id === input.chosenEffectId)
  const endedEffects = withLinkedDependents(selected, input.held)
  return {
    endedEffects,
    releases: endedEffectReleases({
      holderActorId: input.holderActorId,
      held: input.held,
      ended: endedEffects
    })
  }
}

/** Whether any of an action's targets is an enemy of its actor: hostile dispositions, never neutral. */
export function actsAgainstEnemy(input: {
  actorId: string
  targetActorIds: readonly string[]
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
}) {
  const actorDisposition = input.dispositions.get(input.actorId) ?? 'NEUTRAL'
  return input.targetActorIds.some(
    (targetActorId) =>
      encounterActorRelationship(
        actorDisposition,
        input.dispositions.get(targetActorId) ?? 'NEUTRAL'
      ) === 'HOSTILE'
  )
}

/** Each creature's effects that last until it moves (`ON_MOVE`), which a voluntary move ends. */
export function moveEndHolds(
  targets: Iterable<{ actor: { id: string }; activeEffects: readonly ActiveRuleEffectRecord[] }>
) {
  return [...targets].flatMap(({ actor, activeEffects }) =>
    discoverEncounterEventHooks({ effects: activeEffects, events: [{ kind: 'MOVED' }] }).ended.map(
      ({ id }) => ({ actorId: actor.id, effectId: id })
    )
  )
}

/**
 * What an action ends on its holder: the effects that last until its holder takes any action, bonus
 * action or reaction, until an attack roll or a spell cast, and those that end when it is aimed at an
 * enemy (Sanctuary), with the conditions only they held.
 */
export function actionEndedEffects(input: {
  holderActorId: string
  held: readonly ActiveRuleEffectRecord[]
  makesAttackRoll: boolean
  castsSpell?: boolean
  /** Whether the action is aimed at an enemy of the holder (see `actsAgainstEnemy`). */
  againstEnemy: boolean
}) {
  const consumedGrants = discoverEncounterEventHooks({
    effects: input.held,
    events: [
      {
        kind: 'ACTION',
        attackRoll: input.makesAttackRoll,
        spellCast: input.castsSpell ?? false,
        againstEnemy: input.againstEnemy
      }
    ]
  }).ended
  return {
    consumedGrants,
    sourceReleases: endedEffectReleases({
      holderActorId: input.holderActorId,
      held: input.held,
      ended: consumedGrants
    })
  }
}

/**
 * What the holder's attack uses up once it hits: the grants consumed `ON_HIT` (an extra damage die
 * on the next hit), after they added to that attack, with the conditions only they held. `held`
 * leaves out what the action already ended; a miss ends nothing.
 */
export function attackHitEndedEffects(input: {
  holderActorId: string
  held: readonly ActiveRuleEffectRecord[]
  resultPath: string | undefined
}) {
  const consumedGrants =
    input.resultPath === 'ON_HIT' || input.resultPath === 'ON_CRIT'
      ? discoverEncounterEventHooks({ effects: input.held, events: [{ kind: 'HIT' }] }).ended
      : []
  return {
    consumedGrants,
    sourceReleases: endedEffectReleases({
      holderActorId: input.holderActorId,
      held: input.held,
      ended: consumedGrants
    })
  }
}

/**
 * The applications an effect produces, with the temporary hit points it gives marked as its own when
 * it owns them (D156), so its end releases them while it is still the pool's source.
 */
export function withOwnedTemporaryHitPoints<Application extends CharacterRuleActionApplication>(
  applications: readonly Application[],
  effect: Pick<ActiveRuleEffectRecord, 'id' | 'definition'>
): Application[] {
  const owns = effect.definition.stateContributions.some(
    (contribution) => contribution.kind === 'TEMPORARY_HIT_POINTS_OWNERSHIP'
  )
  return applications.map((application) =>
    owns && application.kind === 'TEMPORARY_HIT_POINTS'
      ? { ...application, sourceActiveEffectId: effect.id }
      : application
  )
}
