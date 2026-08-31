import {
  checksumEncounterCurrentProjection,
  type EncounterActorRecord,
  type EncounterRecord
} from '@artificer-toolkit/db'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import {
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  ENCOUNTER_CURRENT_PROJECTION_SCHEMA_VERSION,
  encounterCurrentProjectionSchema,
  type EncounterCurrentProjection
} from '@artificer-toolkit/schema/projections/encounter'

import { snapshotFeatures, stableActors } from './encounterActorState.js'
import {
  requireEncounterActorRuleResult,
  type EncounterActorRuleSnapshot
} from './encounterActorRuleEvaluation.js'

export function compileEncounterCurrentProjection(
  projection: EncounterGmProjectionDto,
  ruleSnapshot: EncounterActorRuleSnapshot
): EncounterCurrentProjection {
  const candidate = encounterCurrentProjectionSchema.parse({
    encounterId: projection.id,
    streamVersion: projection.version,
    projectionSchemaVersion: ENCOUNTER_CURRENT_PROJECTION_SCHEMA_VERSION,
    projectionChecksum: '0'.repeat(64),
    projection,
    ruleSnapshot
  })
  return encounterCurrentProjectionSchema.parse({
    ...candidate,
    projectionChecksum: checksumEncounterCurrentProjection(candidate)
  })
}

export function healthBand(current: number, maximum: number) {
  if (current <= 0) return 'DEFEATED' as const
  if (maximum <= 0 || current >= maximum * 0.75) return 'HEALTHY' as const
  if (current >= maximum * 0.5) return 'WOUNDED' as const
  if (current >= maximum * 0.25) return 'BLOODIED' as const
  return 'CRITICAL' as const
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function snapshotStatBlock(actor: EncounterActorRecord) {
  if (
    actor.kind !== 'CREATURE' ||
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  )
    return null
  const payload = actor.snapshot.payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const abilityScores = payload.abilityScores
  const abilities =
    typeof abilityScores === 'object' && abilityScores !== null && !Array.isArray(abilityScores)
      ? Object.fromEntries(
          Object.entries(abilityScores).filter(
            (entry): entry is [string, number] =>
              typeof entry[1] === 'number' && Number.isFinite(entry[1])
          )
        )
      : null
  return {
    armorClass:
      typeof payload.armorClass === 'number' &&
      Number.isInteger(payload.armorClass) &&
      payload.armorClass >= 0
        ? payload.armorClass
        : null,
    abilityScores: abilities,
    speeds: Array.isArray(payload.speeds) ? payload.speeds : [],
    senses: stringValues(payload.senses),
    damageVulnerabilities: stringValues(payload.damageVulnerabilities),
    damageResistances: stringValues(payload.damageResistances),
    damageImmunities: stringValues(payload.damageImmunities),
    conditionImmunities: stringValues(payload.conditionImmunities)
  }
}

function currentActorIdForProjection(encounter: EncounterRecord): string | null {
  const initiativeState = encounter.initiativeRoundState
  // Legacy in-memory fixtures do not carry normalized initiative state. Live
  // repository reads always set the field, including to null when no current
  // round exists.
  if (initiativeState === undefined) return encounter.currentActorId
  if (
    encounter.status !== 'ACTIVE' ||
    initiativeState === null ||
    initiativeState.round.round !== encounter.round ||
    initiativeState.round.status !== 'ACTIVE'
  ) {
    return null
  }
  const activeParticipants = initiativeState.participants.filter(
    (participant) => participant.status === 'ACTIVE'
  )
  const activeActorId = activeParticipants.length === 1 ? activeParticipants[0]!.actorId : null
  return activeActorId !== null && encounter.actors.some((actor) => actor.id === activeActorId)
    ? activeActorId
    : null
}

export function projectGm(
  encounter: EncounterRecord,
  actorRules: EncounterActorRuleOutput
): EncounterGmProjectionDto {
  return encounterGmProjectionDtoSchema.parse({
    id: encounter.id,
    campaignId: encounter.campaignId,
    sessionId: encounter.sessionId,
    gameSystemId: encounter.gameSystemId,
    blueprintId: encounter.blueprintId,
    blueprintVersion: encounter.blueprintVersion,
    blueprintChecksum: encounter.blueprintChecksum,
    name: encounter.name,
    status: encounter.status,
    automationMode: encounter.automationMode,
    manualReminderMode: encounter.manualReminderMode,
    rulePackRevisionId: encounter.rulePackRevisionId,
    initiativePolicy:
      encounter.initiativePolicySnapshot == null
        ? null
        : {
            definitionId: encounter.initiativePolicySnapshot.policy.definitionId,
            label: encounter.initiativePolicySnapshot.policy.label,
            procedure: encounter.initiativePolicySnapshot.policy.document.procedure,
            cadence: encounter.initiativePolicySnapshot.policy.document.cadence,
            tieResolverDefinitionId: encounter.initiativePolicySnapshot.tieResolver.definitionId,
            tieResolverLabel: encounter.initiativePolicySnapshot.tieResolver.label
          },
    optionalCombatRules:
      encounter.optionalCombatSnapshot?.definitions.map((definition) => ({
        definitionId: definition.definitionId,
        label: definition.label,
        kind: definition.document.kind
      })) ?? [],
    version: encounter.version,
    round: encounter.round,
    currentActorId: currentActorIdForProjection(encounter),
    actors: stableActors(encounter).map((actor) => ({
      id: actor.id,
      encounterId: actor.encounterId,
      kind: actor.kind,
      label: actor.label,
      sourceId: actor.sourceId,
      sourceRevision: actor.sourceRevision,
      systemId: actor.systemId,
      stableTieKey: actor.stableTieKey,
      public: actor.public,
      currentHitPoints: actor.currentHitPoints,
      maxHitPoints: actor.maxHitPoints,
      tempHitPoints: actor.tempHitPoints,
      conditions: actor.conditions,
      resources: actor.resources,
      gmNotes: actor.gmNotes,
      statBlock: snapshotStatBlock(actor),
      features:
        actor.kind === 'CHARACTER'
          ? []
          : snapshotFeatures(actor, requireEncounterActorRuleResult(actorRules, actor.id)),
      initiative: actor.initiative,
      manualOrder: actor.manualOrder,
      healthBand: healthBand(actor.currentHitPoints, actor.maxHitPoints)
    })),
    reminders: encounter.reminders.map((reminder) => ({
      id: reminder.id,
      label: reminder.label,
      timing: reminder.timing,
      round: reminder.round,
      actorId: reminder.actorId,
      public: reminder.public,
      notes: reminder.notes,
      order: reminder.order
    })),
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt
  })
}

/**
 * Derive the player-safe view from a validated committed projection. This
 * keeps gameplay reads on the same projection for GMs and players while
 * retaining the intentionally smaller player contract.
 */
export function projectPlayerEncounterProjection(
  encounter: EncounterGmProjectionDto
): EncounterPlayerProjectionDto {
  return encounterPlayerProjectionDtoSchema.parse({
    id: encounter.id,
    campaignId: encounter.campaignId,
    sessionId: encounter.sessionId,
    gameSystemId: encounter.gameSystemId,
    blueprintId: encounter.blueprintId,
    blueprintVersion: encounter.blueprintVersion,
    blueprintChecksum: encounter.blueprintChecksum,
    name: encounter.name,
    status: encounter.status,
    automationMode: encounter.automationMode,
    rulePackRevisionId: encounter.rulePackRevisionId,
    initiativePolicy: encounter.initiativePolicy,
    optionalCombatRules: encounter.optionalCombatRules,
    version: encounter.version,
    round: encounter.round,
    currentActorId:
      encounter.currentActorId &&
      encounter.actors.find((actor) => actor.id === encounter.currentActorId)?.public
        ? encounter.currentActorId
        : null,
    actors: encounter.actors
      .filter((actor) => actor.public)
      .map((actor) => ({
        id: actor.id,
        encounterId: actor.encounterId,
        kind: actor.kind,
        label: actor.label,
        sourceId: actor.kind === 'CHARACTER' ? actor.sourceId : null,
        sourceRevision: null,
        public: actor.public,
        initiative: actor.initiative,
        manualOrder: actor.manualOrder,
        conditions: actor.conditions,
        healthBand: healthBand(actor.currentHitPoints, actor.maxHitPoints)
      })),
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt
  })
}
