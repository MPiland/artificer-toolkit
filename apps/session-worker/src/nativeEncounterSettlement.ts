import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encodeCharacterRecord,
  readCharacterRecord
} from '@artificer-toolkit/schema/projections/characterStoredState'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import type { prepareEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import type { planNativeEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import type { prepareNativeActionEffectsPlan } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { createLinkedRiders } from '@artificer-toolkit/rules-runtime/encounterActionEffectPlans'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import { prepareActiveRuleEffectRecord } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import {
  buildEncounterMaintenanceTransition,
  planEncounterMaintenanceOwner
} from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import { projectEncounterActionTarget } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import { applyEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import type { EncounterAttackActionTransitionDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type { EncounterMechanicsBatchPlan } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'
import {
  prepareNativeLiveMaintainedState,
  type prepareNativeLiveActionMaintenance
} from './nativeEncounterMaintenance.js'

type CharacterFacts = PreparedLiveCharacterSheet
type Maintenance = NonNullable<Awaited<ReturnType<typeof prepareNativeLiveActionMaintenance>>>
export type NativeLiveMaintenanceOwner = {
  owner: ActiveRuleEffectRecord['owner']
  effects: ActiveRuleEffectRecord[]
  character: Maintenance['owners'][number]['character']
}

/** Who holds an effect the target gains: a Character's own effects belong to the Character. */
export function nativeEffectOwner(
  target: Pick<EncounterRunActorState, 'kind' | 'id' | 'sourceId'>,
  encounterId: string
) {
  return target.kind === 'CHARACTER'
    ? {
        kind: 'CHARACTER' as const,
        characterId:
          target.sourceId ??
          (() => {
            throw new Error('Encounter Character effect owner is incomplete.')
          })()
      }
    : {
        kind: 'ENCOUNTER_ACTOR' as const,
        encounterId,
        targetActorId: target.id
      }
}

/**
 * The Active Rule Effect record a planned action effect becomes on `owner`, stacked after
 * `currentEffects` (which it joins). A single action and each creature of an area create theirs here.
 */
export function createNativeActiveEffect(
  plan: NonNullable<
    ReturnType<typeof prepareNativeActionEffectsPlan<CharacterFacts>>['stateEffect']
  >,
  input: {
    owner: ReturnType<typeof nativeEffectOwner>
    currentEffects: ActiveRuleEffectRecord[]
    occurredAt: string
    maintainedEffectStateId?: string
    id?: string
  }
) {
  const record = prepareActiveRuleEffectRecord({
    id: input.id ?? crypto.randomUUID(),
    owner: input.owner,
    definition: plan.definition,
    lifecycle: plan.lifecycle,
    maintainedEffectStateId: input.maintainedEffectStateId,
    currentEffects: input.currentEffects,
    occurredAt: input.occurredAt
  })
  input.currentEffects.push(record)
  return record
}

/** Projects the exact state after mechanics, effects and maintenance, before concentration runs. */
export function planNativeLiveEncounterSettlement(input: {
  command: ResolveEncounterActionInputDto
  occurrenceId: string
  occurredAt: string
  prepared: Awaited<ReturnType<typeof prepareEncounterActionMechanics<CharacterFacts>>>
  mechanics: ReturnType<typeof planNativeEncounterActionMechanics>
  effects: ReturnType<typeof prepareNativeActionEffectsPlan<CharacterFacts>>
  /** The id the action's lasting effect takes, minted before its applications name it (D156). */
  recurringEffectId: string
  /** The effect plan of the reaction the target used against this action, when it used one. */
  reactionEffect: {
    id: string
    plan: NonNullable<
      ReturnType<typeof prepareNativeActionEffectsPlan<CharacterFacts>>['stateEffect']
    >
  } | null
  /** The timed grants the target's own passive damage triggers made from this hit, after its other effects. */
  damageGrants: readonly {
    id: string
    plan: NonNullable<
      ReturnType<typeof prepareNativeActionEffectsPlan<CharacterFacts>>['stateEffect']
    >
  }[]
  actionEconomy: Awaited<ReturnType<typeof prepareEncounterActionEconomy>>
  actionEconomyOverridden: boolean
  attackAction: EncounterAttackActionTransitionDto | null
  /** The commanding actor's allowance and Attack action a delegated attack spends (DELEGATED_ATTACK). */
  delegation: {
    actorId: string
    consumption: Awaited<ReturnType<typeof prepareEncounterActionEconomy>>
    attackAction: EncounterAttackActionTransitionDto
  } | null
  maintenance: Awaited<ReturnType<typeof prepareNativeLiveActionMaintenance>>
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
}) {
  const { prepared, mechanics, effects } = input
  const maintenance = effects.maintenance ? input.maintenance : null
  const maintainedState = effects.maintenance
    ? prepareNativeLiveMaintainedState({
        completedPolicy: effects.maintenance,
        maintenance,
        encounterId: prepared.state.id,
        ownerActorId: prepared.actor.id,
        actionId: input.command.actionId,
        sourceOccurrenceId: input.occurrenceId,
        occurredAt: input.occurredAt
      })
    : null
  const owner = nativeEffectOwner(prepared.target, prepared.state.id)
  const removedIds = new Set(maintenance?.removed.map((effect) => effect.id))
  const targetEffects = prepared.targetFacts.activeEffects.filter(
    (effect) => !removedIds.has(effect.id)
  )
  const createdEffects: ActiveRuleEffectRecord[] = []
  const create = (
    plan: typeof effects.stateEffect,
    maintainedEffectStateId?: string,
    id?: string
  ) => {
    if (!plan) return null
    const record = createNativeActiveEffect(plan, {
      owner,
      currentEffects: targetEffects,
      occurredAt: input.occurredAt,
      maintainedEffectStateId,
      id
    })
    createdEffects.push(record)
    return record
  }
  const stateEffect = create(effects.stateEffect)
  const recurringEffect = create(
    effects.recurringEffect,
    maintainedState?.id,
    input.recurringEffectId
  )
  const riderEffects = createLinkedRiders(effects.riderEffects, recurringEffect, (plan) =>
    create(plan, effects.riderMaintained ? maintainedState?.id : undefined)
  )
  // The effect of the reaction the target used lands on the target after the attack's own effects.
  const reactionEffect =
    input.reactionEffect && create(input.reactionEffect.plan, undefined, input.reactionEffect.id)
  const damageGrantEffects = input.damageGrants.map((grant) =>
    create(grant.plan, undefined, grant.id)
  )
  const consumedActor = input.actionEconomy
    ? consumeEncounterActionEconomy({
        actor: mechanics.settledSource,
        consumption: input.actionEconomy,
        overridden: input.actionEconomyOverridden
      })
    : prepared.resourceUse || mechanics.sourceResourceMechanics
      ? mechanics.settledSource
      : null
  const economyActor = input.attackAction
    ? applyEncounterAttackActionTransition(
        consumedActor ?? mechanics.settledSource,
        input.attackAction
      )
    : consumedActor
  const actors = new Map(
    prepared.actors.map((actor) => [
      actor.id,
      actor.id === mechanics.mechanics.updatedActor.id
        ? economyActor?.id === actor.id
          ? economyActor
          : mechanics.mechanics.updatedActor
        : economyActor?.id === actor.id
          ? economyActor
          : actor
    ])
  )
  if (input.delegation) {
    const { actorId, consumption, attackAction } = input.delegation
    const commander = actors.get(actorId)
    if (!commander) throw new Error('Encounter settlement actor is unavailable.')
    actors.set(
      actorId,
      applyEncounterAttackActionTransition(
        consumption
          ? consumeEncounterActionEconomy({ actor: commander, consumption, overridden: false })
          : commander,
        attackAction
      )
    )
  }
  const activeEffectsByActorId = new Map(
    [...input.activeEffectsByActorId].map(([actorId, records]) => [
      actorId,
      records.filter((effect) => !removedIds.has(effect.id))
    ])
  )
  activeEffectsByActorId.set(prepared.target.id, targetEffects)
  const projectedTargets = new Map(prepared.movementTargets)
  for (const [actorId, target] of prepared.movementTargets) {
    const actor = actors.get(actorId)
    if (!actor) throw new Error('Encounter settlement actor is unavailable.')
    projectedTargets.set(
      actorId,
      projectEncounterActionTarget({
        target: { ...target, activeEffects: activeEffectsByActorId.get(actorId) ?? [] },
        actor,
        plan: actorId === prepared.target.id ? mechanics.targetPlan : mechanics.sourceResourcePlan,
        campaignId: prepared.state.campaignId,
        gameSystemId: prepared.state.gameSystemId,
        occurredAt: input.occurredAt
      })
    )
  }
  const reconciled = projectNativeLiveMaintenanceOwners({
    actors: prepared.actors.map((actor) => actors.get(actor.id)!),
    projectedTargets,
    activeEffectsByActorId,
    maintenance: maintenance ?? { owners: [], removed: [], characterVersions: [] },
    createdEffects,
    characterPlans: new Map([
      [prepared.target.id, mechanics.targetPlan],
      ...(prepared.actor.id !== prepared.target.id
        ? ([[prepared.actor.id, mechanics.sourceResourcePlan]] as const)
        : [])
    ]),
    campaignId: prepared.state.campaignId,
    gameSystemId: prepared.state.gameSystemId,
    occurredAt: input.occurredAt
  })
  const transitions = projectNativeActionEffectTransitions({
    state: stateEffect,
    recurring: recurringEffect,
    riders: riderEffects,
    targetActorId: prepared.target.id
  })
  return {
    ...reconciled,
    createdEffects,
    maintainedState,
    ...transitions,
    reactionActiveEffectTransitions: projectNativeActionEffectTransitions({
      state: null,
      recurring: reactionEffect,
      targetActorId: prepared.target.id
    }).activeEffectTransitions,
    grantEffectTransitions: damageGrantEffects.flatMap(
      (grant) =>
        projectNativeActionEffectTransitions({
          state: null,
          recurring: grant,
          targetActorId: prepared.target.id
        }).activeEffectTransitions
    ),
    maintenanceTransition:
      maintainedState && maintenance
        ? buildEncounterMaintenanceTransition({
            maintenance,
            createdState: maintainedState,
            createdDependentEffectIds: transitions.activeEffectTransitions.map(
              (effect) => effect.activeEffectId
            )
          })
        : null
  }
}

/** Reconciles a planned removal using the owner versions at this point in action order. */
export function projectNativeLiveMaintenanceOwners(input: {
  actors: readonly EncounterRunActorState[]
  projectedTargets: ReadonlyMap<string, MovementTarget<CharacterFacts>>
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  maintenance: Pick<Maintenance, 'removed' | 'characterVersions'> & {
    owners: NativeLiveMaintenanceOwner[]
  }
  createdEffects: readonly ActiveRuleEffectRecord[]
  characterPlans?: ReadonlyMap<
    string,
    Pick<EncounterMechanicsBatchPlan, 'characterUpdate' | 'characterStreamVersion'> | null
  >
  campaignId: string
  gameSystemId: string
  occurredAt: string
}) {
  const { maintenance, createdEffects } = input
  const actors = new Map(input.actors.map((actor) => [actor.id, actor]))
  const projectedTargets = new Map(input.projectedTargets)

  const activeEffectsByActorId = new Map(
    [...input.activeEffectsByActorId].map(([actorId, effects]) => [actorId, [...effects]])
  )
  const removedIds = new Set(maintenance.removed.map((effect) => effect.id))
  const owners: NativeLiveMaintenanceOwner[] = []
  for (const snapshot of maintenance.owners) {
    const owner = snapshot.owner
    const key = checksumCanonicalJson(owner)
    const target = [...projectedTargets.values()].find((candidate) =>
      owner.kind === 'CHARACTER'
        ? candidate.actor.kind === 'CHARACTER' && candidate.actor.sourceId === owner.characterId
        : candidate.actor.id === owner.targetActorId
    )
    const remaining = snapshot.effects.filter((effect) => !removedIds.has(effect.id))
    remaining.push(
      ...createdEffects.filter((effect) => checksumCanonicalJson(effect.owner) === key)
    )
    let row = snapshot.character
    const characterPlan = target ? input.characterPlans?.get(target.actor.id) : null
    if (row && characterPlan?.characterUpdate && characterPlan.characterStreamVersion !== null) {
      row = encodeCharacterRecord(row, {
        document: characterPlan.characterUpdate.character,
        ...(characterPlan.characterUpdate.sheetState
          ? { sheetState: characterPlan.characterUpdate.sheetState }
          : {}),
        streamVersion: characterPlan.characterStreamVersion,
        updatedAt: input.occurredAt
      })
    }
    const character = row ? readCharacterRecord(row) : null
    const beforeVersion =
      owner.kind === 'CHARACTER'
        ? maintenance.characterVersions.find((entry) => entry.characterId === owner.characterId)
            ?.beforeStreamVersion
        : undefined
    const planned = planEncounterMaintenanceOwner({
      owner,
      removed: maintenance.removed.filter((effect) => checksumCanonicalJson(effect.owner) === key),
      remaining,
      actors: [...actors.values()],
      character:
        row && character && beforeVersion !== undefined
          ? {
              currentStreamVersion: row.play.streamVersion,
              beforeStreamVersion: beforeVersion,
              state: character.state,
              maximumHitPoints: row.play.maximumHitPoints
            }
          : null
    })
    const nextCharacter =
      character && planned.character
        ? {
            ...character,
            state: {
              ...character.state,
              conditions: planned.character.conditions,
              hitpoints: planned.character.hitpoints
            }
          }
        : null
    owners.push({
      owner,
      effects: remaining,
      character:
        row && nextCharacter && planned.character
          ? encodeCharacterRecord(row, {
              document: nextCharacter,
              streamVersion: planned.character.streamVersion,
              updatedAt: input.occurredAt
            })
          : row
    })
    for (const { after: actor } of planned.actors) {
      actors.set(actor.id, actor)
      activeEffectsByActorId.set(actor.id, remaining)
      const prior = projectedTargets.get(actor.id)
      if (prior) {
        projectedTargets.set(
          actor.id,
          projectEncounterActionTarget({
            target: { ...prior, activeEffects: remaining },
            actor,
            plan:
              prior.characterFacts && planned.character
                ? {
                    characterStreamVersion: planned.character.streamVersion,
                    characterUpdate: {
                      character: {
                        ...prior.characterFacts.character,
                        state: {
                          ...prior.characterFacts.character.state,
                          conditions: planned.character.conditions,
                          hitpoints: planned.character.hitpoints
                        }
                      },
                      sheetState: null
                    }
                  }
                : null,
            campaignId: input.campaignId,
            gameSystemId: input.gameSystemId,
            occurredAt: input.occurredAt
          })
        )
      }
    }
  }
  return {
    actors: input.actors.map((actor) => actors.get(actor.id)!),
    projectedTargets,
    activeEffectsByActorId,
    maintenanceOwners: owners
  }
}
