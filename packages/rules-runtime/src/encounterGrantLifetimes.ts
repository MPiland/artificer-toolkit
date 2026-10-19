import type {
  EncounterRunActorState,
  EncounterRunCharacterActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  ActiveEffectConsumeEvent,
  ActiveEffectEndEvent,
  EncounterMaintainedEffectDescriptorDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import type { ConcentrationEndReason } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { campaignMinutesForRounds, ROUNDS_PER_CAMPAIGN_MINUTE } from './campaignClock.js'
import { carriedCreatureForm } from './encounterActorForm.js'
import { encounterActorIdleTurnMark } from './encounterActorState.js'
import { encounterActorRelationship } from './encounterActionTargetPolicy.js'
import {
  isEffectLiveInEncounter,
  turnEffectOwner,
  type TurnEffectBoundary
} from './encounterTurnEffectState.js'

type GrantHolder = {
  actor: Pick<EncounterRunActorState, 'id' | 'kind' | 'sourceId'>
  effects: readonly ActiveRuleEffectRecord[]
}

export type EncounterGrantTick = {
  effect: ActiveRuleEffectRecord
  owner: ReturnType<typeof turnEffectOwner>
} & ({ kind: 'UPDATE'; remainingTicks: number } | { kind: 'EXPIRE' })

function isModifierGrant(effect: ActiveRuleEffectRecord) {
  return (
    effect.definition.schemaVersion === 2 &&
    effect.definition.stateContributions.some(({ kind }) => kind === 'MODIFIER_GRANT')
  )
}

export function ownsCondition(effect: ActiveRuleEffectRecord) {
  return (
    effect.definition.schemaVersion === 2 &&
    effect.definition.stateContributions.some(({ kind }) => kind === 'CONDITION_OWNERSHIP')
  )
}

/**
 * The effects the first occurrence of the event, by their holder, uses up or ends: those that list
 * it in `consumeOnFirstEvents` or `endOnEvents`. Both lists mean the same here (the event applies,
 * then the effect is gone, restored by the same receipt); the caller releases any condition an
 * ended effect alone held (`endedMaintenanceConditions`). An action can be several events at once (a
 * spell attack is an attack roll and a cast); an effect listing more than one ends once.
 */
export function effectsEndedBy(
  effects: readonly ActiveRuleEffectRecord[],
  ...events: readonly (ActiveEffectConsumeEvent | ActiveEffectEndEvent)[]
) {
  return effects.filter(
    ({ definition }) =>
      definition.schemaVersion === 2 &&
      [...definition.recurrence.consumeOnFirstEvents, ...definition.recurrence.endOnEvents].some(
        (listed) => events.includes(listed)
      )
  )
}

/**
 * Grants whose lifetime follows their holder's state: they end on incapacitation, on a named
 * condition, or when the holder lets go of the item they are bound to.
 */
export function stateBoundGrants<Effect extends ActiveRuleEffectRecord>(
  effects: readonly Effect[]
) {
  return effects.filter(
    (effect) =>
      isModifierGrant(effect) &&
      (effect.definition.recurrence.endOnEvents.includes('ON_INCAPACITATED') ||
        effect.definition.recurrence.endOnEvents.includes('ON_CHOSEN_ITEM_RELEASED') ||
        effect.definition.recurrence.endOnConditionIds.length > 0)
  )
}

/** The item a grant is bound to (Shillelagh's club); null for an unbound grant. */
function boundItemInstanceId(effect: ActiveRuleEffectRecord) {
  if (effect.definition.schemaVersion !== 2) return null
  for (const contribution of effect.definition.stateContributions)
    if (contribution.kind === 'MODIFIER_GRANT' && contribution.boundItem)
      return contribution.boundItem.itemInstanceId
  return null
}

/**
 * The holder's grants its state ends (D95): those that end on incapacitation when it is
 * incapacitated or defeated, those that name a condition it has, and those that end on release
 * when no hand of it holds their bound item, whatever else is true of them.
 */
export function grantsEndedByHolderState<Effect extends ActiveRuleEffectRecord>(
  effects: readonly Effect[],
  state: {
    reason: Exclude<ConcentrationEndReason, 'CHOSEN'> | null
    conditionIds: readonly string[]
    heldItemInstanceIds: readonly string[]
  }
) {
  const incapacitated = state.reason === 'INCAPACITATED' || state.reason === 'DEFEATED'
  // A defeated holder's conditions are not read (readHolderEndState), so none can end a grant.
  const conditionIds = state.reason === 'DEFEATED' ? [] : state.conditionIds
  return stateBoundGrants(effects).filter((effect) => {
    const { endOnEvents, endOnConditionIds } = effect.definition.recurrence
    const boundItemId = boundItemInstanceId(effect)
    return (
      (incapacitated && endOnEvents.includes('ON_INCAPACITATED')) ||
      endOnConditionIds.some((conditionId) => conditionIds.includes(conditionId)) ||
      (endOnEvents.includes('ON_CHOSEN_ITEM_RELEASED') &&
        boundItemId !== null &&
        !state.heldItemInstanceIds.includes(boundItemId))
    )
  })
}

/**
 * The actor whose turns count a timed grant down: its holder, or the Encounter actor that applied
 * it. A source-anchored grant carried in from an earlier Run has no source here, so its holder
 * counts it (D151).
 */
function grantAnchorActorId(
  effect: ActiveRuleEffectRecord,
  holderActorId: string,
  encounterId: string
) {
  const { expiration } = effect.definition.recurrence
  if (expiration.kind !== 'TICKS') return null
  const { origin } = effect.definition
  return expiration.anchor === 'SOURCE' &&
    origin.kind === 'ENCOUNTER' &&
    origin.sourceAggregateId === encounterId
    ? origin.sourceActorId
    : holderActorId
}

/**
 * Timed effects anchored to an actor that left the Run can no longer count down, so they end with
 * it. Holder-anchored effects, and those carried in from an earlier Run, keep their own lifetime.
 */
export function planDepartedSourceGrantRemovals<Effect extends ActiveRuleEffectRecord>(input: {
  encounterId: string
  departedActorId: string
  holders: readonly { actor: GrantHolder['actor']; effects: readonly Effect[] }[]
}): Effect[] {
  return input.holders.flatMap(({ effects }) =>
    effects.filter(
      (effect) =>
        effect.definition.recurrence.expiration.kind === 'TICKS' &&
        effect.definition.recurrence.expiration.anchor === 'SOURCE' &&
        effect.definition.origin.kind === 'ENCOUNTER' &&
        effect.definition.origin.sourceAggregateId === input.encounterId &&
        effect.definition.origin.sourceActorId === input.departedActorId
    )
  )
}

/**
 * Grants, and other timed effects counted on their source's turns, store no recurrence stage and
 * count down at the boundary of their anchor actor's turn, so the turn-effect kernel never
 * owns them.
 */
export function planEncounterGrantTicks(input: {
  encounterId: string
  stage: TurnEffectBoundary['stage']
  turnActorId: string
  holders: readonly GrantHolder[]
}): EncounterGrantTick[] {
  const ticks: EncounterGrantTick[] = []
  for (const { actor, effects } of input.holders) {
    for (const effect of effects) {
      const { recurrence } = effect.definition
      const expiration = recurrence.expiration
      const remaining = effect.lifecycle.remainingTicks
      if (
        remaining === null ||
        recurrence.recurrenceStage !== 'NONE' ||
        expiration.kind !== 'TICKS' ||
        (!isModifierGrant(effect) && expiration.anchor !== 'SOURCE') ||
        expiration.decrementStage !== input.stage ||
        !isEffectLiveInEncounter(effect, actor, input.encounterId)
      )
        continue
      if (grantAnchorActorId(effect, actor.id, input.encounterId) !== input.turnActorId) continue
      const owner = turnEffectOwner(actor, input.encounterId)
      ticks.push(
        remaining <= 1
          ? { kind: 'EXPIRE', effect, owner }
          : { kind: 'UPDATE', effect, owner, remainingTicks: remaining - 1 }
      )
    }
  }
  return ticks.sort(
    (left, right) =>
      left.effect.createdOrdinal - right.effect.createdOrdinal ||
      left.effect.id.localeCompare(right.effect.id)
  )
}

const ATTACK_ROLL_RESULT_PATHS: readonly string[] = ['ON_HIT', 'ON_MISS', 'ON_CRIT']

/** Whether a settled action's d20s hold an attack roll its source made against a creature hostile to it. */
export function attackedHostileCreature(input: {
  d20s: readonly ({ resultPath: string } | null | undefined)[]
  source: Pick<EncounterRunActorState, 'disposition'>
  target: Pick<EncounterRunActorState, 'disposition'>
}) {
  return (
    encounterActorRelationship(input.source.disposition, input.target.disposition) === 'HOSTILE' &&
    input.d20s.some(
      (d20) =>
        d20 !== null && d20 !== undefined && ATTACK_ROLL_RESULT_PATHS.includes(d20.resultPath)
    )
  )
}

/**
 * What the end of the turn actor's turn does to its idle-bound grants (SRD Rage). An armed actor,
 * one that neither attacked a hostile creature nor took damage since its last turn ended, loses the
 * grants that end on `ON_IDLE_TURN`; an engaged one keeps them and is armed again. `effects` need
 * only be read for an armed actor. A grant created on the actor's own turn arrives engaged, so its
 * first check is at the end of the actor's next turn.
 */
export function planIdleTurnCheck<Effect extends ActiveRuleEffectRecord>(input: {
  encounterId: string
  actor: Pick<EncounterRunActorState, 'kind' | 'resources'>
  effects: readonly Effect[]
}) {
  const mark = encounterActorIdleTurnMark(input.actor)
  if (mark === null) return { ended: [], nextMark: null }
  if (mark === 'ENGAGED') return { ended: [], nextMark: 'ARMED' as const }
  const ended = effectsEndedBy(input.effects, 'ON_IDLE_TURN').filter((effect) =>
    isEffectLiveInEncounter(effect, input.actor, input.encounterId)
  )
  const holdsOthers = effectsEndedBy(input.effects, 'ON_IDLE_TURN').length > ended.length
  return { ended, nextMark: holdsOthers ? ('ARMED' as const) : null }
}

/**
 * D99, SPELLS-5.14: a completed Run hands its Characters' timed grants and condition-owning effects
 * to the Campaign clock, 6 seconds per remaining round rounded up to whole minutes from the clock's
 * minute at completion. Without a clock they stop counting and last until the GM ends them. A
 * detached Concentration effect keeps its caster stamp.
 */
export function planCarriedOverEffects(input: {
  effects: readonly ActiveRuleEffectRecord[]
  clockMinute: number | null
  /** The creature form the Character wears at completion, carried on the effect that holds it. */
  form?: EncounterRunCharacterActorState['form']
}) {
  return input.effects.flatMap((effect) => {
    const wornForm = input.form?.effectId === effect.id ? input.form : null
    const remaining = effect.lifecycle.remainingTicks
    if (
      remaining === null ||
      !(isModifierGrant(effect) || ownsCondition(effect) || wornForm) ||
      effect.definition.recurrence.expiration.kind !== 'TICKS'
    )
      // An already carried form effect keeps its Campaign expiry and takes the hit points it ended on.
      return wornForm && remaining === null
        ? [
            {
              effect,
              lifecycle: { ...effect.lifecycle, carriedCreatureForm: carriedCreatureForm(wornForm) }
            }
          ]
        : []
    const { concentrationCasterCharacterId } = effect.lifecycle
    const lifecycle: ActiveRuleEffectRecord['lifecycle'] = {
      schemaVersion: 1,
      remainingTicks: null,
      ...(concentrationCasterCharacterId === undefined ? {} : { concentrationCasterCharacterId }),
      ...(wornForm ? { carriedCreatureForm: carriedCreatureForm(wornForm) } : {}),
      expiresAtCampaignMinute:
        input.clockMinute === null ? null : input.clockMinute + campaignMinutesForRounds(remaining)
    }
    return [{ effect, lifecycle }]
  })
}

export type CarriedEffectResume<Effect extends ActiveRuleEffectRecord> =
  | { kind: 'UPDATE'; effect: Effect; lifecycle: ActiveRuleEffectRecord['lifecycle'] }
  | { kind: 'EXPIRE'; effect: Effect }

/**
 * D99, D151, SPELLS-5.13: a later Run's START hands the carried-over effects back from the Campaign
 * clock to rounds, 10 per minute left before their expiry and never more than they first had. One
 * whose expiry the clock has reached ends. Without a clock, or with no expiry (carried without a
 * clock), nothing resumes and the effect lasts until the GM ends it.
 */
export function planResumedCarriedEffects<Effect extends ActiveRuleEffectRecord>(input: {
  effects: readonly Effect[]
  clockMinute: number | null
}): CarriedEffectResume<Effect>[] {
  const { clockMinute } = input
  if (clockMinute === null) return []
  return input.effects.flatMap((effect): CarriedEffectResume<Effect>[] => {
    const { expiration } = effect.definition.recurrence
    const { expiresAtCampaignMinute, ...lifecycle } = effect.lifecycle
    if (
      typeof expiresAtCampaignMinute !== 'number' ||
      expiration.kind !== 'TICKS' ||
      !(isModifierGrant(effect) || ownsCondition(effect))
    )
      return []
    const remainingTicks = Math.min(
      expiration.initialRemaining,
      (expiresAtCampaignMinute - clockMinute) * ROUNDS_PER_CAMPAIGN_MINUTE
    )
    return remainingTicks <= 0
      ? [{ kind: 'EXPIRE', effect }]
      : [{ kind: 'UPDATE', effect, lifecycle: { ...lifecycle, remainingTicks } }]
  })
}

/**
 * D151, SPELLS-5.12: a later Run's START gives each Character caster in the Run back the Concentration
 * that the carried grants of the Run's Characters still stamp them with, as the System's maintenance
 * definition, so a failed check or a new Concentration ends those grants through the usual paths.
 * A caster outside the Run, or a grant already relinked, reinstates nothing.
 */
export async function planReinstatedConcentrations<Effect extends ActiveRuleEffectRecord>(input: {
  gameSystemId: string
  actors: readonly Pick<EncounterRunActorState, 'id' | 'kind' | 'sourceId'>[]
  effects: readonly Effect[]
  /** Read only when some caster reinstates. */
  readDefinition(): Promise<ReusableDefinitionCurrentDto | null>
}) {
  const byCaster = new Map<string, Effect[]>()
  for (const effect of input.effects) {
    const casterCharacterId = effect.lifecycle.concentrationCasterCharacterId
    if (effect.owner.kind !== 'CHARACTER' || effect.maintainedEffectStateId !== null) continue
    if (typeof casterCharacterId === 'string')
      byCaster.set(casterCharacterId, [...(byCaster.get(casterCharacterId) ?? []), effect])
  }
  const reinstated = [...byCaster].flatMap(([casterCharacterId, effects]) => {
    const caster = input.actors.find(
      (actor) => actor.kind === 'CHARACTER' && actor.sourceId === casterCharacterId
    )
    return caster ? [{ caster, casterCharacterId, effects }] : []
  })
  if (reinstated.length === 0) return []
  const definition = await input.readDefinition()
  if (
    !definition ||
    definition.gameSystemId !== input.gameSystemId ||
    definition.definitionFamilyKey !== 'rule-maintenance'
  )
    throw new Error('The System Concentration definition is unavailable.')
  const policy = ruleMaintenanceReusableDefinitionDocumentDtoSchema.parse(definition.document)
  return reinstated.map(({ caster, casterCharacterId, effects }) => ({
    casterActorId: caster.id,
    effects,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: definition.id,
      definitionChecksum: definition.checksum,
      provenance: { kind: 'CARRIED', casterCharacterId },
      sourceActorId: caster.id,
      replacementPolicy: policy.replacementPolicy,
      emptyDependentPolicy: policy.emptyDependentPolicy
    } satisfies EncounterMaintainedEffectDescriptorDto
  }))
}

/**
 * D99: a Character caster who starts another Concentration ends the carried-over Concentration
 * grants stamped with them. A grant with no stamp (a Creature caster) is never ended this way.
 */
export function planConcentrationCarriedGrantEnds<Effect extends ActiveRuleEffectRecord>(input: {
  casterCharacterId: string
  effects: readonly Effect[]
}) {
  return input.effects.filter(
    ({ owner, lifecycle }) =>
      owner.kind === 'CHARACTER' &&
      lifecycle.concentrationCasterCharacterId === input.casterCharacterId
  )
}

/** Carried-over effects whose Campaign-clock expiry the clock has reached. */
export function expiredCarriedOverGrants<Effect extends ActiveRuleEffectRecord>(
  effects: readonly Effect[],
  clockMinute: number
) {
  return effects.filter(({ lifecycle }) => {
    const expiry = lifecycle.expiresAtCampaignMinute
    return typeof expiry === 'number' && expiry <= clockMinute
  })
}
