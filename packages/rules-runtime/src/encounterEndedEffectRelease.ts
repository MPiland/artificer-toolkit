import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import { ENDED_EFFECT_RELEASE_OPERATION_KEY } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type {
  CharacterEndedEffectReleaseApplication,
  CharacterRuleActionApplication
} from './characterRuleActionSystemAdapter.js'
import { endedMaintenanceConditions } from './encounterActionMaintenance.js'
import { encounterActorRelationship } from './encounterActionTargetPolicy.js'
import { effectsEndedBy } from './encounterGrantLifetimes.js'

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
    const owner = input.ended.find(
      ({ definition }) =>
        definition.schemaVersion === 2 &&
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
    .filter(
      ({ definition }) =>
        definition.schemaVersion === 2 &&
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
 * What an action ends on its target: the effects used up by an attack roll against the holder
 * (`ON_ATTACKED`, after their modifiers applied to that roll), those whose `DAMAGE_TAKEN` end
 * trigger the outcome meets (damage that survives the holder's defenses, of a type the trigger
 * names, by someone the trigger allows), and the conditions only they held. The holder's own
 * mechanics batch applies the releases in the same transaction as the effects' deletion.
 */
export function targetEndedEffects(input: {
  holderActorId: string
  held: readonly ActiveRuleEffectRecord[]
  /** Whether the action made an attack roll against the holder. */
  attacked: boolean
  /** The outcome applications this action settles on the holder. */
  applications: readonly CharacterRuleActionApplication[]
  /** Who dealt the damage; null when nobody did, so only `ANYONE` triggers meet it. */
  damagerActorId: string | null
  /** Every Encounter actor's disposition, to tell the effect source's side from the rest. */
  dispositions: ReadonlyMap<string, EncounterActorDispositionDto>
}) {
  const dealt = input.applications.filter(
    (application) =>
      application.kind === 'DAMAGE' &&
      application.targetActorId === input.holderActorId &&
      application.resolvedAmount > 0
  )
  const onSourceSide = (sourceActorId: string | null) =>
    sourceActorId !== null &&
    input.damagerActorId !== null &&
    (input.damagerActorId === sourceActorId ||
      encounterActorRelationship(
        input.dispositions.get(input.damagerActorId) ?? 'NEUTRAL',
        input.dispositions.get(sourceActorId) ?? 'NEUTRAL'
      ) === 'ALLIED')
  const attackConsumed = input.attacked ? effectsEndedBy(input.held, 'ON_ATTACKED') : []
  const endedEffects = input.held.filter((effect) => {
    const { definition } = effect
    if (attackConsumed.includes(effect)) return true
    if (!dealt.length || definition.schemaVersion !== 2) return false
    const sourceActorId =
      definition.origin.kind === 'ENCOUNTER' ? definition.origin.sourceActorId : null
    return definition.recurrence.endOnTriggers.some(
      (trigger) =>
        trigger.event === 'DAMAGE_TAKEN' &&
        (trigger.by === 'ANYONE' || onSourceSide(sourceActorId)) &&
        dealt.some(
          (application) =>
            trigger.damageTypeIds === null ||
            (application.kind === 'DAMAGE' &&
              trigger.damageTypeIds.includes(application.damageTypeId))
        )
    )
  })
  return {
    endedEffects,
    releases: endedEffectReleases({
      holderActorId: input.holderActorId,
      held: input.held,
      ended: endedEffects
    })
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
      : input.held.filter(
          ({ definition }) =>
            definition.schemaVersion === 2 &&
            definition.recurrence.endOnTriggers.some(
              (trigger) =>
                trigger.event === 'ACTION_USED_ON_HOLDER' &&
                trigger.actionDefinitionIds.includes(input.basicActionDefinitionId)
            )
        )
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

/**
 * What an action ends on its holder: the effects that last until an attack roll or a spell cast, and
 * those that end when it is aimed at an enemy (Sanctuary), with the conditions only they held. An
 * action that is neither ends nothing.
 */
export function actionEndedEffects(input: {
  holderActorId: string
  held: readonly ActiveRuleEffectRecord[]
  makesAttackRoll: boolean
  castsSpell?: boolean
  /** Whether the action is aimed at an enemy of the holder (see `actsAgainstEnemy`). */
  againstEnemy: boolean
}) {
  const ended = new Set(
    effectsEndedBy(
      input.held,
      ...(input.makesAttackRoll ? (['ON_ATTACK_ROLL'] as const) : []),
      ...(input.castsSpell ? (['ON_CAST_SPELL'] as const) : [])
    ).map(({ id }) => id)
  )
  const endsOn = [
    ...(input.makesAttackRoll && input.againstEnemy ? (['ATTACK_ROLL'] as const) : []),
    ...(input.castsSpell && input.againstEnemy ? (['SPELL_CAST'] as const) : [])
  ]
  for (const { id, definition } of input.held)
    if (
      definition.schemaVersion === 2 &&
      definition.recurrence.endOnTriggers.some(
        (trigger) =>
          (trigger.event === 'ATTACK_ROLL' || trigger.event === 'SPELL_CAST') &&
          endsOn.includes(trigger.event)
      )
    )
      ended.add(id)
  const consumedGrants = input.held.filter(({ id }) => ended.has(id))
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
  const owns =
    effect.definition.schemaVersion === 2 &&
    effect.definition.stateContributions.some(
      (contribution) => contribution.kind === 'TEMPORARY_HIT_POINTS_OWNERSHIP'
    )
  return applications.map((application) =>
    owns && application.kind === 'TEMPORARY_HIT_POINTS'
      ? { ...application, sourceActiveEffectId: effect.id }
      : application
  )
}
