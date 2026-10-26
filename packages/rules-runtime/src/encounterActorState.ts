import { featureDtoSchema, type FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'
import type { EncounterProjectionInitiativeRoundStateInput } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import {
  encounterAttackActionStateDtoSchema,
  type EncounterAttackActionStateDto
} from '@artificer-toolkit/schema/projections/encounterAttackAction'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { RuleCapabilityRefreshBoundaryDto } from '@artificer-toolkit/schema/shared/ruleState'

import { takesInitiativeTurns } from './encounterInitiativeCursor.js'

export function requireSnapshotIdentity(actor: EncounterRunActorState) {
  if (
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  )
    throw new Error('Encounter initiative actor snapshot is unavailable.')
  const snapshot = actor.snapshot as Record<string, unknown>
  if (
    snapshot.kind !== actor.kind ||
    snapshot.systemId !== actor.systemId ||
    (actor.kind === 'CHARACTER' && snapshot.sourceRevision !== undefined) ||
    (actor.kind === 'CREATURE' && snapshot.sourceRevision !== actor.sourceRevision) ||
    (actor.kind === 'CUSTOM' &&
      snapshot.sourceRevision !== undefined &&
      snapshot.sourceRevision !== actor.sourceRevision)
  ) {
    throw new Error('Encounter initiative actor source identity is stale.')
  }
  if (actor.kind !== 'CUSTOM' && snapshot.id !== actor.sourceId) {
    throw new Error('Encounter initiative actor source identity is stale.')
  }
  return snapshot
}

type ActorRead = {
  kind: string
  snapshot: unknown
  resources: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A Creature's type from its snapshot; null for Characters, whose type is not in their facts. */
export function snapshotCreatureTypeId(actor: Pick<ActorRead, 'kind' | 'snapshot'>): string | null {
  if (actor.kind !== 'CREATURE') return null
  const snapshot = isRecord(actor.snapshot) ? actor.snapshot : null
  const payload = isRecord(snapshot?.payload) ? snapshot.payload : null
  return typeof payload?.creatureTypeId === 'string' ? payload.creatureTypeId : null
}

/** A Creature's ability score from its snapshot; null for Characters, whose scores are not in their facts. */
export function snapshotAbilityScore(
  actor: Pick<ActorRead, 'kind' | 'snapshot'>,
  abilityCode: string
): number | null {
  if (actor.kind !== 'CREATURE') return null
  const snapshot = isRecord(actor.snapshot) ? actor.snapshot : null
  const payload = isRecord(snapshot?.payload) ? snapshot.payload : null
  const scores = isRecord(payload?.abilityScores) ? payload.abilityScores : null
  return typeof scores?.[abilityCode] === 'number' ? scores[abilityCode] : null
}

export function snapshotFeatureDefinitions(
  actor: Pick<ActorRead, 'kind' | 'snapshot'>
): FeatureDto[] {
  if (actor.kind !== 'CREATURE') return []
  const snapshot = isRecord(actor.snapshot) ? actor.snapshot : null
  const payload = isRecord(snapshot?.payload) ? snapshot.payload : null
  const features = payload?.features
  if (!Array.isArray(features)) return []

  return features.flatMap((feature) => {
    const parsed = featureDtoSchema.safeParse(feature)
    return parsed.success ? [parsed.data] : []
  })
}

export function featureChargeUsed(actor: Pick<ActorRead, 'resources'>, featureId: string): number {
  const resources = isRecord(actor.resources) ? actor.resources : null
  const charges = isRecord(resources?.featureCharges) ? resources.featureCharges : null
  const used = charges?.[featureId]
  return typeof used === 'number' && Number.isInteger(used) && used >= 0 ? used : 0
}

export function withFeatureChargeUsed(
  actor: Pick<ActorRead, 'resources'>,
  featureId: string,
  used: number
): Record<string, unknown> {
  const resources = isRecord(actor.resources) ? actor.resources : {}
  const existing = resources.featureCharges
  const featureCharges = isRecord(existing) ? existing : {}
  return { ...resources, featureCharges: { ...featureCharges, [featureId]: used } }
}

export type EncounterIdleTurnMark = 'ARMED' | 'ENGAGED'

/**
 * Where an actor stands on an idle-bound grant (SRD Rage): `ARMED` while it holds one and has
 * neither attacked a hostile creature nor taken damage since its last turn ended, `ENGAGED` once it
 * has. Absent for an actor that never held one, so damage reads no effects for it.
 */
export function encounterActorIdleTurnMark(
  actor: Pick<ActorRead, 'resources'>
): EncounterIdleTurnMark | null {
  const mark = isRecord(actor.resources) ? actor.resources.idleTurnMark : undefined
  return mark === 'ARMED' || mark === 'ENGAGED' ? mark : null
}

export function withEncounterActorIdleTurnMark(
  actor: Pick<ActorRead, 'resources'>,
  mark: EncounterIdleTurnMark | null
): Record<string, unknown> {
  const { idleTurnMark: _mark, ...resources } = isRecord(actor.resources) ? actor.resources : {}
  return mark === null ? resources : { ...resources, idleTurnMark: mark }
}

export function encounterRuleUsageUsed(
  actor: Pick<ActorRead, 'resources'>,
  definitionId: string
): number {
  const normalizedDefinitionId = serverUuidIdentityDtoSchema.parse(definitionId)
  return encounterRuleUsageSnapshot(actor)[normalizedDefinitionId] ?? 0
}

export function encounterRuleUsageSnapshot(
  actor: Pick<ActorRead, 'resources'>
): Readonly<Record<string, number>> {
  const resources = isRecord(actor.resources) ? actor.resources : null
  const usage = resources?.ruleUsage
  if (usage === undefined) return {}
  if (typeof usage !== 'object' || usage === null || Array.isArray(usage)) {
    throw new Error('Encounter rule usage state is invalid.')
  }
  const entries = Object.entries(usage)
  if (entries.length > RULE_GRAPH_LIMITS.RUNTIME_FACTS) {
    throw new Error('Encounter rule usage state exceeds its bounded size.')
  }
  const normalized: Record<string, number> = {}
  for (const [definitionId, used] of entries) {
    const normalizedDefinitionId = serverUuidIdentityDtoSchema.parse(definitionId)
    if (
      normalized[normalizedDefinitionId] !== undefined ||
      typeof used !== 'number' ||
      !Number.isSafeInteger(used) ||
      used < 0
    ) {
      throw new Error('Encounter rule usage value is invalid.')
    }
    normalized[normalizedDefinitionId] = used
  }
  return Object.fromEntries(
    Object.entries(normalized).sort(([left], [right]) => left.localeCompare(right))
  )
}

/** The Attack action the actor last opened, even when a later turn has made it stale. */
export function encounterAttackActionState(
  actor: Pick<ActorRead, 'resources'>
): EncounterAttackActionStateDto | null {
  const resources = isRecord(actor.resources) ? actor.resources : null
  const stored = resources?.attackAction
  return stored === undefined ? null : encounterAttackActionStateDtoSchema.parse(stored)
}

export function withEncounterAttackActionState(
  actor: Pick<ActorRead, 'resources'>,
  state: EncounterAttackActionStateDto | null
): Record<string, unknown> {
  const { attackAction: _previous, ...resources } = isRecord(actor.resources) ? actor.resources : {}
  return state === null ? resources : { ...resources, attackAction: state }
}

/** The Run's actors in turn order; each owned actor follows its owner, on whose turn it acts (D190a). */
export function stableActors<
  TActor extends {
    id: string
    manualOrder: number | null
    initiative: number | null
    stableTieKey: string
    owner?: { ownerActorId: string } | null
  }
>(encounter: {
  actors: readonly TActor[]
  round?: number
  initiativeRoundState?: EncounterProjectionInitiativeRoundStateInput | null
}): TActor[] {
  const owned = encounter.actors.filter((actor) => !takesInitiativeTurns(actor))
  const turnOrder = initiativeTurnOrder({
    ...encounter,
    actors: encounter.actors.filter(takesInitiativeTurns)
  })
  const ordered = turnOrder.flatMap((actor) => [
    actor,
    ...owned.filter((candidate) => candidate.owner!.ownerActorId === actor.id)
  ])
  return [...ordered, ...owned.filter((actor) => !ordered.includes(actor))]
}

function initiativeTurnOrder<
  TActor extends {
    id: string
    manualOrder: number | null
    initiative: number | null
    stableTieKey: string
  }
>(encounter: {
  actors: readonly TActor[]
  round?: number
  initiativeRoundState?: EncounterProjectionInitiativeRoundStateInput | null
}): TActor[] {
  const state = encounter.initiativeRoundState
  if (state?.round.status === 'ACTIVE' && state.round.round === encounter.round) {
    const ordinalByActor = new Map(
      state.participants.map((participant) => [participant.actorId, participant.turnOrderOrdinal])
    )
    const ordinals = [...ordinalByActor.values()]
    if (
      state.participants.length !== encounter.actors.length ||
      ordinalByActor.size !== encounter.actors.length ||
      new Set(ordinals).size !== encounter.actors.length ||
      ordinals.some(
        (ordinal) =>
          ordinal === null ||
          !Number.isInteger(ordinal) ||
          ordinal < 0 ||
          ordinal >= encounter.actors.length
      ) ||
      encounter.actors.some((actor) => !ordinalByActor.has(actor.id))
    )
      throw new Error('Normalized initiative order does not match the Encounter actors.')
    return [...encounter.actors].sort(
      (left, right) => ordinalByActor.get(left.id)! - ordinalByActor.get(right.id)!
    )
  }
  return [...encounter.actors].sort((left, right) => {
    const manualLeft = left.manualOrder ?? Number.MAX_SAFE_INTEGER
    const manualRight = right.manualOrder ?? Number.MAX_SAFE_INTEGER
    if (manualLeft !== manualRight) return manualLeft - manualRight
    const initiativeLeft = left.initiative ?? Number.MIN_SAFE_INTEGER
    const initiativeRight = right.initiative ?? Number.MIN_SAFE_INTEGER
    if (initiativeLeft !== initiativeRight) return initiativeRight - initiativeLeft
    return left.stableTieKey.localeCompare(right.stableTieKey)
  })
}

/** Writes one System-defined usage value without interpreting its policy. */
export function withEncounterRuleUsageUsed(
  actor: Pick<ActorRead, 'resources'>,
  definitionId: string,
  used: number
): Record<string, unknown> {
  const normalizedDefinitionId = serverUuidIdentityDtoSchema.parse(definitionId)
  if (!Number.isSafeInteger(used) || used < 0) {
    throw new Error('Encounter rule usage value must be a nonnegative safe integer.')
  }
  const resources = isRecord(actor.resources) ? actor.resources : {}
  const existing = resources.ruleUsage
  if (
    existing !== undefined &&
    (typeof existing !== 'object' || existing === null || Array.isArray(existing))
  ) {
    throw new Error('Encounter rule usage state is invalid.')
  }
  // Nothing used is the absence of a record, so a refresh, a spend and an undo store the same row.
  const ruleUsage = Object.entries(isRecord(existing) ? existing : {}).filter(
    ([id]) => id !== normalizedDefinitionId
  )
  if (used > 0) ruleUsage.push([normalizedDefinitionId, used])
  const otherResources = Object.entries(resources).filter(([key]) => key !== 'ruleUsage')
  return Object.fromEntries(
    ruleUsage.length === 0
      ? otherResources
      : [...otherResources, ['ruleUsage', Object.fromEntries(ruleUsage)]]
  )
}

/** The stored `EACH_TURN` usage entries, each with the turn it was spent on. */
function encounterTurnUsageEntries(
  actor: Pick<ActorRead, 'resources'>
): readonly [string, { turnSequence: number; used: number }][] {
  const usage = isRecord(actor.resources) ? actor.resources.turnUsage : undefined
  if (usage === undefined) return []
  if (!isRecord(usage) || Object.keys(usage).length > RULE_GRAPH_LIMITS.RUNTIME_FACTS)
    throw new Error('Encounter turn usage state is invalid.')
  return Object.entries(usage).map(([definitionId, entry]) => {
    if (
      !isRecord(entry) ||
      Object.keys(entry).length !== 2 ||
      !Number.isSafeInteger(entry.turnSequence) ||
      (entry.turnSequence as number) < 0 ||
      !Number.isSafeInteger(entry.used) ||
      (entry.used as number) < 1
    )
      throw new Error('Encounter turn usage value is invalid.')
    return [
      serverUuidIdentityDtoSchema.parse(definitionId),
      { turnSequence: entry.turnSequence as number, used: entry.used as number }
    ]
  })
}

/**
 * This turn's `EACH_TURN` usage by capability definition. Each entry keeps the `turnSequence` it was
 * spent on, so one from any other turn (a GM turn move starts a new one too) reads as unspent and no
 * refresh ever writes it.
 */
export function encounterTurnUsageSnapshot(
  actor: Pick<ActorRead, 'resources'>,
  turnSequence: number
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    encounterTurnUsageEntries(actor).flatMap(([definitionId, entry]) =>
      entry.turnSequence === turnSequence ? [[definitionId, entry.used]] : []
    )
  )
}

type EncounterAllowance = {
  definitionId: string
  refreshBoundary: RuleCapabilityRefreshBoundaryDto
}

/** How much of an allowance is used now, read from the record its refresh boundary keeps. */
export function encounterAllowanceUsed(
  actor: Pick<ActorRead, 'resources'>,
  allowance: EncounterAllowance,
  turnSequence: number
): number {
  if (allowance.refreshBoundary === 'START_OF_TURN')
    return encounterRuleUsageUsed(actor, allowance.definitionId)
  const definitionId = serverUuidIdentityDtoSchema.parse(allowance.definitionId)
  return encounterTurnUsageSnapshot(actor, turnSequence)[definitionId] ?? 0
}

/**
 * Writes an allowance's usage to the record its refresh boundary keeps. An `EACH_TURN` write stamps
 * the current turn and drops the entries earlier turns left, so the record stays this turn's.
 */
export function withEncounterAllowanceUsed(
  actor: Pick<ActorRead, 'resources'>,
  allowance: EncounterAllowance,
  turnSequence: number,
  used: number
): Record<string, unknown> {
  if (allowance.refreshBoundary === 'START_OF_TURN')
    return withEncounterRuleUsageUsed(actor, allowance.definitionId, used)
  const definitionId = serverUuidIdentityDtoSchema.parse(allowance.definitionId)
  if (!Number.isSafeInteger(used) || used < 0 || !Number.isSafeInteger(turnSequence))
    throw new Error('Encounter turn usage value must be a nonnegative safe integer.')
  const turnUsage = encounterTurnUsageEntries(actor).filter(
    ([id, entry]) => id !== definitionId && entry.turnSequence === turnSequence
  )
  if (used > 0) turnUsage.push([definitionId, { turnSequence, used }])
  const { turnUsage: _turnUsage, ...resources } = isRecord(actor.resources) ? actor.resources : {}
  return turnUsage.length === 0
    ? resources
    : { ...resources, turnUsage: Object.fromEntries(turnUsage) }
}
