import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import type { prepareEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import type { planNativeEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import type { prepareNativeActionEffectsPlan } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import {
  prepareActiveRuleEffectRecord,
  prepareMaintainedEffectStateRecord
} from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import {
  buildEncounterMaintenanceTransition,
  planEncounterMaintenanceOwner
} from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import { projectEncounterActionTarget } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type { EncounterMechanicsBatchPlan } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { prepareNativeLiveCharacterSheet } from './nativeCharacterRules.js'
import type { prepareNativeLiveActionMaintenance } from './nativeEncounterMaintenance.js'
import * as z from 'zod/mini'

type CharacterFacts = Awaited<ReturnType<typeof prepareNativeLiveCharacterSheet>>
type Maintenance = NonNullable<Awaited<ReturnType<typeof prepareNativeLiveActionMaintenance>>>
export type NativeLiveMaintenanceOwner = {
  owner: ActiveRuleEffectRecord['owner']
  effects: ActiveRuleEffectRecord[]
  character: Pick<
    NonNullable<Maintenance['owners'][number]['character']>,
    'id' | 'streamVersion' | 'documentJson' | 'checksum' | 'sheetState' | 'updatedAt'
  > | null
}
const characterDocument = z.omit(characterAuthoredDtoSchema, { primaryRulesCatalogueId: true })

/** Projects the exact state after mechanics, effects and maintenance, before concentration runs. */
export function planNativeLiveEncounterSettlement(input: {
  command: ResolveEncounterActionInputDto
  occurrenceId: string
  occurredAt: string
  prepared: Awaited<ReturnType<typeof prepareEncounterActionMechanics<CharacterFacts>>>
  mechanics: ReturnType<typeof planNativeEncounterActionMechanics>
  effects: ReturnType<typeof prepareNativeActionEffectsPlan<CharacterFacts>>
  actionEconomy: Awaited<ReturnType<typeof prepareEncounterActionEconomy>>
  actionEconomyOverridden: boolean
  maintenance: Awaited<ReturnType<typeof prepareNativeLiveActionMaintenance>>
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
}) {
  const { prepared, mechanics, effects } = input
  const maintenance = effects.maintenance ? input.maintenance : null
  if (
    effects.maintenance &&
    (!maintenance ||
      checksumCanonicalJson(effects.maintenance) !== checksumCanonicalJson(maintenance.policy))
  )
    throw new Error('The completed action maintenance policy changed.')
  const maintainedState = maintenance
    ? prepareMaintainedEffectStateRecord({
        id: crypto.randomUUID(),
        encounterId: prepared.state.id,
        ownerActorId: prepared.actor.id,
        occurredAt: input.occurredAt,
        descriptor: {
          schemaVersion: 2,
          maintenanceDefinitionId: maintenance.policy.definitionId,
          definitionChecksum: maintenance.definitionChecksum,
          sourceActionId: input.command.actionId,
          sourceOccurrenceId: input.occurrenceId,
          sourceActorId: prepared.actor.id,
          replacementPolicy: maintenance.policy.replacementPolicy,
          emptyDependentPolicy: maintenance.policy.emptyDependentPolicy
        }
      })
    : null
  const owner =
    prepared.target.kind === 'CHARACTER'
      ? {
          kind: 'CHARACTER' as const,
          characterId:
            prepared.target.sourceId ??
            (() => {
              throw new Error('Encounter Character effect owner is incomplete.')
            })()
        }
      : {
          kind: 'ENCOUNTER_ACTOR' as const,
          encounterId: prepared.state.id,
          targetActorId: prepared.target.id
        }
  const removedIds = new Set(maintenance?.removed.map((effect) => effect.id))
  const targetEffects = prepared.targetFacts.activeEffects.filter(
    (effect) => !removedIds.has(effect.id)
  )
  const createdEffects: ActiveRuleEffectRecord[] = []
  const create = (kind: 'STATE' | 'RECURRING', plan: typeof effects.stateEffect) => {
    if (!plan) return null
    const record = prepareActiveRuleEffectRecord({
      id: crypto.randomUUID(),
      owner,
      definition: plan.definition,
      lifecycle: plan.lifecycle,
      maintainedEffectStateId: kind === 'RECURRING' ? maintainedState?.id : undefined,
      currentEffects: targetEffects,
      occurredAt: input.occurredAt
    })
    targetEffects.push(record)
    createdEffects.push(record)
    return record
  }
  const stateEffect = create('STATE', effects.stateEffect)
  const recurringEffect = create('RECURRING', effects.recurringEffect)
  const economyActor = input.actionEconomy
    ? consumeEncounterActionEconomy({
        actor: mechanics.settledSource,
        consumption: input.actionEconomy,
        overridden: input.actionEconomyOverridden
      })
    : prepared.resourceUse || mechanics.sourceResourceMechanics
      ? mechanics.settledSource
      : null
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
    targetActorId: prepared.target.id
  })
  return {
    ...reconciled,
    createdEffects,
    maintainedState,
    ...transitions,
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
      row = {
        ...row,
        documentJson: canonicalizeRuleDocument(characterPlan.characterUpdate.character),
        checksum: checksumRuleDocument(characterPlan.characterUpdate.character),
        ...(characterPlan.characterUpdate.sheetState
          ? {
              sheetState: {
                documentJson: canonicalizeRuleDocument(characterPlan.characterUpdate.sheetState),
                checksum: checksumRuleDocument(characterPlan.characterUpdate.sheetState)
              }
            }
          : {}),
        streamVersion: characterPlan.characterStreamVersion,
        updatedAt: input.occurredAt
      }
    }
    const character = row ? characterDocument.parse(JSON.parse(row.documentJson)) : null
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
              currentStreamVersion: row.streamVersion,
              beforeStreamVersion: beforeVersion,
              conditions: character.state.conditions ?? []
            }
          : null
    })
    const nextCharacter =
      character && planned.character
        ? { ...character, state: { ...character.state, conditions: planned.character.conditions } }
        : null
    owners.push({
      owner,
      effects: remaining,
      character:
        row && nextCharacter && planned.character
          ? {
              ...row,
              ...(planned.character.changed
                ? {
                    documentJson: canonicalizeRuleDocument(nextCharacter),
                    checksum: checksumRuleDocument(nextCharacter)
                  }
                : {}),
              streamVersion: planned.character.streamVersion,
              updatedAt: input.occurredAt
            }
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
                          conditions: planned.character.conditions
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
