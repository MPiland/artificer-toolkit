import type {
  ActiveRuleEffectOwner,
  ActiveRuleEffectRecord,
  EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import { maintainedEffectTransitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { readEncounterActorConditionState } from './encounterCharacterMechanicsBatch.js'
import { effectiveHitPointMaximum } from './character/activeEffectGrantTotals.js'
import { encounterGrantsEnabledDomain } from './encounterActiveGrants.js'
import { SpellcastingLockedError } from './encounterErrors.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { planConcentrationCarriedGrantEnds } from './encounterGrantLifetimes.js'
import { sharedZonePlacement } from './encounterZonePlacement.js'
import {
  temporaryHitPointsAfterEffectsEnd,
  withActorTemporaryHitPoints,
  withCharacterTemporaryHitPoints
} from '@artificer-toolkit/schema/shared/temporaryHitPoints'

/** Selects and validates current maintenance before the caller consumes action evidence. */
export async function prepareEncounterActionMaintenance<TOwners extends object>(input: {
  prepared: Pick<
    Awaited<ReturnType<typeof prepareEncounterActionMechanics>>,
    'state' | 'actor' | 'plan' | 'source' | 'adapter'
  >
  /** The acting actor's active effects; a `SPELLCASTING_LOCK` grant among them bars a new Concentration. */
  activeEffects: readonly ActiveRuleEffectRecord[]
  readDefinition: (definitionId: string) => Promise<ReusableDefinitionCurrentDto | null>
  readSlot: (definitionId: string) => Promise<{
    state: EncounterMaintainedEffectStateRecord | null
    dependents: ActiveRuleEffectRecord[]
  }>
  /** D99: the Run Characters' (or stored Characters') carried grants; omitted where not covered. */
  readCarried?: () => Promise<readonly ActiveRuleEffectRecord[]>
  readOwners: (
    removed: readonly ActiveRuleEffectRecord[],
    carried: readonly ActiveRuleEffectRecord[]
  ) => Promise<TOwners>
}) {
  const { prepared } = input
  const published =
    prepared.plan.kind === 'SINGLE_GRAPH' ? prepared.plan.published : prepared.plan.test.published
  const plans =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? [prepared.source.entry.compilation.activeEffectPlan]
      : (prepared.adapter.activeEffectPlans?.({
          action: prepared.source.capability,
          published
        }) ?? [])
  // A zone-only cast keeps its Concentration on the zone placement, not on any creature effect.
  const zone =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.entry.compilation.zonePlacement
      : null
  // The zones a cast picks between open one Concentration (D140).
  const zoneMaintenance = zone ? sharedZonePlacement(zone).maintenance : null
  // A summon keeps its Concentration on its carrier effect, not on any creature outcome.
  const summonMaintenance =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? (prepared.source.entry.compilation.summonPlacement?.entry.maintenance ?? null)
      : null
  // The creature effects, the zone and the summon of one cast name one Concentration, not several.
  const policies = [
    ...new Map(
      [...plans.map((plan) => plan?.maintenance), zoneMaintenance, summonMaintenance].flatMap(
        (policy) => (policy ? [[checksumCanonicalJson(policy), policy] as const] : [])
      )
    ).values()
  ]
  if (policies.length > 1)
    throw new Error('Encounter action selected multiple maintenance policies.')
  const policy = policies[0]
  if (!policy) return null
  if (encounterGrantsEnabledDomain(input.activeEffects, 'SPELLCASTING_LOCK'))
    throw new SpellcastingLockedError()
  const definition = await input.readDefinition(policy.definitionId)
  if (
    !definition ||
    definition.gameSystemId !== prepared.state.gameSystemId ||
    definition.definitionFamilyKey !== 'rule-maintenance' ||
    (policy.definitionChecksum !== null && policy.definitionChecksum !== definition.checksum)
  )
    throw new Error('The active-effect maintenance definition is no longer current.')
  const publishedPolicy = ruleMaintenanceReusableDefinitionDocumentDtoSchema.parse(
    definition.document
  )
  if (
    publishedPolicy.replacementPolicy !== policy.replacementPolicy ||
    publishedPolicy.emptyDependentPolicy !== policy.emptyDependentPolicy
  )
    throw new Error('The active-effect maintenance policy does not match its published definition.')
  const slot = await input.readSlot(policy.definitionId)
  const prior = slot.state
  const casterCharacterId = prepared.actor.kind === 'CHARACTER' ? prepared.actor.sourceId : null
  const carried = planConcentrationCarriedGrantEnds({
    casterCharacterId: casterCharacterId ?? '',
    effects: casterCharacterId && input.readCarried ? await input.readCarried() : []
  })
  const byOwnerOrder = (left: ActiveRuleEffectRecord, right: ActiveRuleEffectRecord) => {
    const key = (effect: ActiveRuleEffectRecord) =>
      `${effect.owner.kind === 'CHARACTER' ? `0:${effect.owner.characterId}` : `1:${effect.owner.targetActorId}`}:${effect.createdOrdinal.toString().padStart(10, '0')}:${effect.id}`
    return key(left).localeCompare(key(right))
  }
  const removed = [...slot.dependents, ...carried].sort(byOwnerOrder)
  const sortedCarried = [...carried].sort(byOwnerOrder)
  return {
    policy,
    definitionChecksum: definition.checksum,
    prior,
    removed,
    carried: sortedCarried,
    ...(await input.readOwners(removed, sortedCarried))
  }
}

/** An ended source cannot clear a condition still owned by a baseline or another active effect. */
export function endedMaintenanceConditions(
  removed: readonly ActiveRuleEffectRecord[],
  remaining: readonly ActiveRuleEffectRecord[]
) {
  const ended = new Set<string>()
  const retained = new Set<string>()
  for (const effect of removed) {
    for (const contribution of effect.definition.stateContributions) {
      if (contribution.kind !== 'CONDITION_OWNERSHIP') continue
      if (contribution.baselinePresent) retained.add(contribution.conditionId)
      else ended.add(contribution.conditionId)
    }
  }
  for (const effect of remaining) {
    for (const contribution of effect.definition.stateContributions)
      if (contribution.kind === 'CONDITION_OWNERSHIP') retained.add(contribution.conditionId)
  }
  return new Set([...ended].filter((id) => !retained.has(id)))
}

/**
 * Settles a Character whose effects ended, wherever they end (an Encounter settlement or its Sheet):
 * conditions only the removed effects held end, current hit points fall to the maximum the
 * remaining effects allow (Aid ending), and temporary hit points a removed effect gave are lost (D156).
 */
export function settleCharacterEndedEffects(input: {
  state: Pick<CharacterAuthored['state'], 'conditions' | 'hitpoints'>
  /** The stored maximum, before active effects. */
  maximumHitPoints: number
  removed: readonly ActiveRuleEffectRecord[]
  remaining: readonly ActiveRuleEffectRecord[]
}) {
  const ended = endedMaintenanceConditions(input.removed, input.remaining)
  const priorConditions = input.state.conditions ?? []
  const conditions = priorConditions.filter((condition) => !ended.has(condition.conditionTypeId))
  const { hitpoints } = input.state
  const current = Math.min(
    hitpoints.current,
    effectiveHitPointMaximum(input.maximumHitPoints, input.remaining)
  )
  const temporary = temporaryHitPointsAfterEffectsEnd(
    { amount: hitpoints.temp, sourceEffectId: hitpoints.tempSourceEffectId ?? null },
    input.removed.map((effect) => effect.id)
  )
  return {
    conditions,
    hitpoints: withCharacterTemporaryHitPoints({ ...hitpoints, current }, temporary),
    changed:
      conditions.length !== priorConditions.length ||
      current !== hitpoints.current ||
      temporary.amount !== hitpoints.temp
  }
}

/**
 * Reconciles the post-mechanics owner once, sharing its preceding Character version increment:
 * conditions only the removed effects held end, current hit points fall to the maximum the
 * remaining effects allow (Aid ending), and temporary hit points a removed effect gave are lost (D156).
 */
export function planEncounterMaintenanceOwner(input: {
  owner: ActiveRuleEffectOwner
  removed: readonly ActiveRuleEffectRecord[]
  remaining: readonly ActiveRuleEffectRecord[]
  actors: readonly EncounterRunActorState[]
  character: {
    currentStreamVersion: number
    beforeStreamVersion: number
    state: Pick<CharacterAuthored['state'], 'conditions' | 'hitpoints'>
    /** The stored maximum, before active effects. */
    maximumHitPoints: number
  } | null
}) {
  const { owner } = input
  const ended = endedMaintenanceConditions(input.removed, input.remaining)
  let character: {
    conditions: NonNullable<CharacterAuthored['state']['conditions']>
    hitpoints: CharacterAuthored['state']['hitpoints']
    changed: boolean
    streamVersion: number
  } | null = null
  let ownerActors: readonly EncounterRunActorState[]
  if (owner.kind === 'CHARACTER') {
    const current = input.character
    if (
      !current ||
      (current.currentStreamVersion !== current.beforeStreamVersion &&
        current.currentStreamVersion !== current.beforeStreamVersion + 1)
    )
      throw new Error('Maintained-effect Character version changed during settlement.')
    character = {
      ...settleCharacterEndedEffects({
        state: current.state,
        maximumHitPoints: current.maximumHitPoints,
        removed: input.removed,
        remaining: input.remaining
      }),
      streamVersion: current.beforeStreamVersion + 1
    }
    ownerActors = input.actors.filter(
      (actor) => actor.kind === 'CHARACTER' && actor.sourceId === owner.characterId
    )
  } else {
    const actor = input.actors.find((actor) => actor.id === owner.targetActorId)
    if (!actor) throw new Error('Maintained-effect Encounter owner is unavailable.')
    ownerActors = [actor]
  }
  const removedIds = input.removed.map((effect) => effect.id)
  const releasedTemporary = (holder: {
    tempHitPoints: number
    tempHitPointsSourceEffectId?: string
  }) =>
    temporaryHitPointsAfterEffectsEnd(
      { amount: holder.tempHitPoints, sourceEffectId: holder.tempHitPointsSourceEffectId ?? null },
      removedIds
    )
  return {
    character,
    actors: ownerActors.map((actor) => {
      // A Character's conditions and hit points live on the Character, which `character` updates;
      // only a form it holds keeps its own temporary hit points on the actor.
      if (actor.kind === 'CHARACTER') {
        const formTemporary = actor.form ? releasedTemporary(actor.form) : null
        return {
          before: actor,
          after:
            actor.form && formTemporary && formTemporary.amount !== actor.form.tempHitPoints
              ? { ...actor, form: withActorTemporaryHitPoints(actor.form, formTemporary) }
              : actor
        }
      }
      const currentHitPoints = Math.min(
        actor.currentHitPoints,
        effectiveHitPointMaximum(actor.maxHitPoints, input.remaining)
      )
      const temporary = releasedTemporary(actor)
      if (
        !ended.size &&
        currentHitPoints === actor.currentHitPoints &&
        temporary.amount === actor.tempHitPoints
      )
        return { before: actor, after: actor }
      const conditions = readEncounterActorConditionState(actor.conditions ?? [])
      return {
        before: actor,
        after: encounterRunActorStateSchema.parse(
          withActorTemporaryHitPoints(
            {
              ...actor,
              currentHitPoints,
              conditions: conditions.values.filter(
                (_value, index) => !ended.has(conditions.ids[index]!)
              )
            },
            temporary
          )
        )
      }
    })
  }
}

export function buildEncounterMaintenanceTransition(input: {
  maintenance: {
    prior: EncounterMaintainedEffectStateRecord | null
    removed: readonly ActiveRuleEffectRecord[]
    /** The part of `removed` that is carried-over grants rather than the replaced state's dependents. */
    carried: readonly ActiveRuleEffectRecord[]
    characterVersions: readonly { characterId: string; beforeStreamVersion: number }[]
  }
  createdState: EncounterMaintainedEffectStateRecord
  createdDependentEffectIds: string[]
}) {
  const { maintenance } = input
  const prior = maintenance.prior
  const state = input.createdState
  const createdProvenance = state.descriptor.provenance
  if (createdProvenance.kind !== 'ACTION')
    throw new Error('An action creates its maintained state from that action.')
  const carriedIds = new Set(maintenance.carried.map((effect) => effect.id))
  const removedIdentity = (effect: ActiveRuleEffectRecord) => ({
    activeEffectId: effect.id,
    createdOrdinal: effect.createdOrdinal,
    expectedVersion: effect.version,
    definitionChecksum: effect.definitionChecksum,
    lifecycleChecksum: effect.lifecycleChecksum
  })
  const removedReceipt = (effect: ActiveRuleEffectRecord) => ({
    ...(effect.owner.kind === 'CHARACTER'
      ? { kind: 'CHARACTER', characterId: effect.owner.characterId }
      : {
          kind: 'ENCOUNTER_ACTOR',
          targetActorId: effect.owner.targetActorId
        }),
    ...removedIdentity(effect)
  })
  return maintainedEffectTransitionDtoSchema.parse({
    kind: 'REPLACE_SAME_DEFINITION',
    priorState: prior
      ? {
          id: prior.id,
          version: prior.version,
          maintenanceDefinitionId: prior.maintenanceDefinitionId,
          descriptorChecksum: prior.descriptorChecksum,
          sourceActorId: prior.ownerActorId
        }
      : null,
    removedDependentEffects: maintenance.removed
      .filter((effect) => !carriedIds.has(effect.id))
      .map(removedReceipt),
    endedCarriedGrants: maintenance.carried.map((effect) => {
      if (effect.owner.kind !== 'CHARACTER') throw new Error('Only a Character grant is carried.')
      return { characterId: effect.owner.characterId, ...removedIdentity(effect) }
    }),
    createdState: {
      id: state.id,
      version: state.version,
      maintenanceDefinitionId: state.maintenanceDefinitionId,
      descriptorChecksum: state.descriptorChecksum,
      definitionChecksum: state.descriptor.definitionChecksum,
      sourceActionId: createdProvenance.sourceActionId,
      sourceOccurrenceId: createdProvenance.sourceOccurrenceId,
      sourceActorId: state.ownerActorId
    },
    characterOwnerTransitions: maintenance.characterVersions.map((entry) => ({
      ...entry,
      afterStreamVersion: entry.beforeStreamVersion + 1
    })),
    createdDependentEffectIds: input.createdDependentEffectIds
  })
}

/**
 * The transition of an area creature whose effect joins the state another creature's outcome
 * created: it replaces and ends nothing, which the carrying creature's transition already did.
 */
export function buildEncounterJoinedMaintenanceTransition(
  input: Omit<Parameters<typeof buildEncounterMaintenanceTransition>[0], 'maintenance'>
) {
  return buildEncounterMaintenanceTransition({
    ...input,
    maintenance: { prior: null, removed: [], carried: [], characterVersions: [] }
  })
}
