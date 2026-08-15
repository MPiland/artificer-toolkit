import type { EncounterActorRecord, EncounterRecord } from '@artificer-toolkit/db'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import {
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'

import { snapshotFeatures, stableActors } from './encounterActorState.js'
import { requireEncounterActorRuleResult } from './encounterActorRuleEvaluation.js'

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

export function projectGm(
  encounter: EncounterRecord,
  actorRules: EncounterActorRuleOutput
): EncounterGmProjectionDto {
  return encounterGmProjectionDtoSchema.parse({
    id: encounter.id,
    campaignId: encounter.campaignId,
    sessionId: encounter.sessionId,
    templateId: encounter.templateId,
    templateVersion: encounter.templateVersion,
    name: encounter.name,
    status: encounter.status,
    rulePackRevisionId: encounter.rulePackRevisionId,
    version: encounter.version,
    round: encounter.round,
    currentActorId: encounter.currentActorId,
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

export function projectPlayer(encounter: EncounterRecord): EncounterPlayerProjectionDto {
  return encounterPlayerProjectionDtoSchema.parse({
    id: encounter.id,
    campaignId: encounter.campaignId,
    sessionId: encounter.sessionId,
    templateId: encounter.templateId,
    templateVersion: encounter.templateVersion,
    name: encounter.name,
    status: encounter.status,
    rulePackRevisionId: encounter.rulePackRevisionId,
    version: encounter.version,
    round: encounter.round,
    currentActorId:
      encounter.currentActorId &&
      encounter.actors.find((actor) => actor.id === encounter.currentActorId)?.public
        ? encounter.currentActorId
        : null,
    actors: stableActors(encounter)
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
