import type {
  EncounterRunActorState,
  EncounterRunCharacterActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { endEventExemptionPayloadDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterMaintainedEffectDescriptorDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import type { ConcentrationEndReason } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { withLinkedDependents } from './activeEffectLinks.js'
import { campaignMinutesForRounds, ROUNDS_PER_CAMPAIGN_MINUTE } from './campaignClock.js'
import { carriedCreatureForm, creatureFormContribution } from './encounterActorForm.js'
import { holderStateRestrictionsHold } from './encounterActiveGrants.js'
import { encounterActorIdleTurnMark } from './encounterActorState.js'
import { encounterActorRelationship } from './encounterActionTargetPolicy.js'
import { endSubscriptions } from './events/effectHooks.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'
import type { EncounterEvent } from './events/encounterEventTable.js'
import {
  effectAnchorActorId,
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
  return effect.definition.stateContributions.some(({ kind }) => kind === 'MODIFIER_GRANT')
}

export function ownsCondition(effect: ActiveRuleEffectRecord) {
  return effect.definition.stateContributions.some(({ kind }) => kind === 'CONDITION_OWNERSHIP')
}

/**
 * Grants and creature forms whose lifetime follows their holder's state: they end on
 * incapacitation, on a named condition (Wild Shape on Unconscious), or when the holder lets go of
 * the item they are bound to.
 */
export function stateBoundGrants<Effect extends ActiveRuleEffectRecord>(
  effects: readonly Effect[]
) {
  return effects.filter(
    (effect) =>
      (isModifierGrant(effect) || creatureFormContribution(effect) !== null) &&
      endSubscriptions(effect).some(
        (subscription) =>
          (subscription.event === 'INCAPACITATED' && subscription.of === 'HOLDER') ||
          subscription.event === 'ITEM_RELEASED' ||
          subscription.event === 'CONDITION_HELD'
      )
  )
}

/**
 * The holder's grants its state ends (D95): those that end on incapacitation when it is
 * incapacitated or defeated, those that name a condition it has, and those that end on release
 * when it neither holds nor wears their bound item, whatever else is true of them.
 */
export function grantsEndedByHolderState<Effect extends ActiveRuleEffectRecord>(
  effects: readonly Effect[],
  state: {
    reason: Exclude<ConcentrationEndReason, 'CHOSEN'> | null
    conditionIds: readonly string[]
    itemInstanceIdsOnActor: readonly string[]
  }
) {
  const incapacitated = state.reason === 'INCAPACITATED' || state.reason === 'DEFEATED'
  const events: EncounterEvent[] = [
    ...(incapacitated ? [{ kind: 'INCAPACITATED', of: 'HOLDER' } as const] : []),
    // A defeated holder's conditions are not read (readHolderEndState), so none can end a grant.
    ...(state.reason === 'DEFEATED'
      ? []
      : [{ kind: 'CONDITION_HELD', conditionIds: state.conditionIds } as const]),
    { kind: 'ITEM_RELEASED', itemInstanceIdsOnActor: state.itemInstanceIdsOnActor }
  ]
  return discoverEncounterEventHooks({ effects: stateBoundGrants(effects), events }).ended
}

/** Grants that end when the Encounter actor that applied them is incapacitated or defeated. */
export function sourceBoundGrants<Effect extends ActiveRuleEffectRecord>(
  effects: readonly Effect[]
) {
  return effects.filter(
    (effect) =>
      isModifierGrant(effect) &&
      effect.definition.origin.kind === 'ENCOUNTER' &&
      endSubscriptions(effect).some(
        (subscription) => subscription.event === 'INCAPACITATED' && subscription.of === 'SOURCE'
      )
  )
}

/**
 * The grants, held by any actor, that their source's committed state ends: those with an
 * `INCAPACITATED` end trigger of `SOURCE` whose source is incapacitated or defeated. `sourceReasons`
 * maps an actor id to why its Concentration would end now (see `encounterConcentrationEndReason`);
 * a source it does not name is unchanged and ends nothing.
 */
export function grantsEndedBySourceState<Effect extends ActiveRuleEffectRecord>(
  effects: readonly Effect[],
  sourceReasons: ReadonlyMap<string, Exclude<ConcentrationEndReason, 'CHOSEN'> | null>
) {
  const sourceActorIds = new Set(
    [...sourceReasons]
      .filter(([, reason]) => reason === 'INCAPACITATED' || reason === 'DEFEATED')
      .map(([actorId]) => actorId)
  )
  return discoverEncounterEventHooks({
    effects: sourceBoundGrants(effects),
    events: [{ kind: 'INCAPACITATED', of: 'SOURCE', sourceActorIds }]
  }).ended
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
        effect.definition.recurrence.anchor === 'SOURCE' &&
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
    const owner = turnEffectOwner(actor, input.encounterId)
    const counted = effects.flatMap((effect) => {
      const { recurrence } = effect.definition
      const expiration = recurrence.expiration
      const remaining = effect.lifecycle.remainingTicks
      return remaining === null ||
        recurrence.recurrenceStage !== 'NONE' ||
        expiration.kind !== 'TICKS' ||
        (!isModifierGrant(effect) && recurrence.anchor !== 'SOURCE') ||
        expiration.decrementStage !== input.stage ||
        !isEffectLiveInEncounter(effect, actor, input.encounterId) ||
        effectAnchorActorId(effect, actor.id, input.encounterId) !== input.turnActorId
        ? []
        : [{ effect, remaining }]
    })
    // An effect linked to an expiring one ends with it (D172), as Frenzy ends with Rage.
    const expired = withLinkedDependents(
      counted.filter(({ remaining }) => remaining <= 1).map(({ effect }) => effect),
      effects
    )
    const expiredIds = new Set(expired.map(({ id }) => id))
    ticks.push(
      ...expired.map((effect) => ({ kind: 'EXPIRE' as const, effect, owner })),
      ...counted
        .filter(({ effect }) => !expiredIds.has(effect.id))
        .map(({ effect, remaining }) => ({
          kind: 'UPDATE' as const,
          effect,
          owner,
          remainingTicks: remaining - 1
        }))
    )
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
 * The authored ids of the holder's own active effects that its passive features keep from ending on
 * `event` (END_EVENT_EXEMPTION: Persistent Rage keeps Rage through an idle turn). A grant bound to
 * the holder's own active effect holds only while that effect is active; its other deferred holder
 * conditions fail closed.
 */
export function endEventExemptAuthoredEffectIds(input: {
  featureModifiers: readonly CharacterGrantFoldOutput['modifiers'][number][]
  event: string
  activeAuthoredEffectIds: readonly string[]
}): string[] {
  return input.featureModifiers.flatMap((modifier) => {
    if (
      modifier.valueDomainCode !== 'END_EVENT_EXEMPTION' ||
      modifier.source.kind !== 'AUTHORED' ||
      !holderStateRestrictionsHold(modifier.deferredRequirements, {
        activeAuthoredEffectIds: input.activeAuthoredEffectIds
      })
    )
      return []
    const { events, effectIds } = endEventExemptionPayloadDtoSchema.parse(modifier.payload)
    return events.includes(input.event) ? effectIds : []
  })
}

/**
 * What the end of the turn actor's turn does to its idle-bound grants (SRD Rage). An armed actor,
 * one that neither attacked a hostile creature nor took damage since its last turn ended, loses the
 * grants that end on `ON_IDLE_TURN`; an engaged one keeps them and is armed again. A grant its
 * `featureModifiers` exempt from `ON_IDLE_TURN` (Persistent Rage) is kept and keeps the actor
 * armed. `effects` need only be read for an armed actor. A grant created on the actor's own turn
 * arrives engaged, so its first check is at the end of the actor's next turn.
 */
export function planIdleTurnCheck<Effect extends ActiveRuleEffectRecord>(input: {
  encounterId: string
  actor: Pick<EncounterRunActorState, 'kind' | 'resources'>
  effects: readonly Effect[]
  featureModifiers: readonly CharacterGrantFoldOutput['modifiers'][number][]
}) {
  const mark = encounterActorIdleTurnMark(input.actor)
  if (mark === null) return { ended: [], nextMark: null }
  if (mark === 'ENGAGED') return { ended: [], nextMark: 'ARMED' as const }
  const idleBound = discoverEncounterEventHooks({
    effects: input.effects,
    events: [{ kind: 'IDLE_TURN' }]
  }).ended
  const exempt = endEventExemptAuthoredEffectIds({
    featureModifiers: input.featureModifiers,
    event: 'ON_IDLE_TURN',
    activeAuthoredEffectIds: input.effects.map(({ definition }) => definition.authoredEffectId)
  })
  // An effect linked to a kept one (Frenzy to a persistent Rage) is kept with it (D172).
  const kept = new Set(
    withLinkedDependents(
      idleBound.filter(
        (effect) =>
          !isEffectLiveInEncounter(effect, input.actor, input.encounterId) ||
          exempt.includes(effect.definition.authoredEffectId)
      ),
      input.effects
    ).map(({ id }) => id)
  )
  const ended = idleBound.filter(({ id }) => !kept.has(id))
  const holdsOthers = idleBound.length > ended.length
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
