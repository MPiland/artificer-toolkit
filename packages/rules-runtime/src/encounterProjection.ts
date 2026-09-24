import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'
import {
  encounterGmProjectionDtoSchema,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  EncounterProjectionActorInput,
  EncounterProjectionInput
} from '@artificer-toolkit/schema/projections/encounterProjectionInput'

import { snapshotFeatures, stableActors } from './encounterActorState.js'
import { requireEncounterActorRuleResult } from './encounterActorRuleOutput.js'
import { healthBand } from './encounterPlayerProjection.js'
import { validateInitiativeCursor } from './encounterInitiativeCursor.js'

export { healthBand, projectPlayerEncounterProjection } from './encounterPlayerProjection.js'

/** Projects a current Run with its normalized initiative round already loaded. */
export function projectCurrentEncounterGm(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  rules: EncounterActorRuleOutput
  initiativeRoundState: EncounterInitiativeRoundStateDto | null
}) {
  const { state, actors, rules, initiativeRoundState } = input
  if (state.status === 'ACTIVE') {
    if (!initiativeRoundState) throw new Error('The normalized initiative round is unavailable.')
    if (
      initiativeRoundState.round.policySnapshotChecksum !==
      (state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshotChecksum)
    )
      throw new Error('Initiative policy snapshot does not match the Encounter Run.')
    validateInitiativeCursor({
      state: initiativeRoundState,
      currentActorId: state.currentActorId,
      actorIds: state.actorIds,
      allowedSideIds: state.sides.map((side) => side.id)
    })
  }
  return projectGm({ ...state, actors, initiativeRoundState }, rules)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function snapshotStatBlock(actor: EncounterProjectionActorInput) {
  if (actor.kind !== 'CREATURE' || !isRecord(actor.snapshot)) return null
  const payload = actor.snapshot.payload
  if (!isRecord(payload)) return null
  const abilityScores = payload.abilityScores
  const abilities = isRecord(abilityScores)
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

function currentActorIdForProjection(encounter: EncounterProjectionInput): string | null {
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
  encounter: EncounterProjectionInput,
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
