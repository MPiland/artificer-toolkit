import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import {
  encounterActorProjectionFactsSchema,
  encounterSourceProjectionFactsSchema,
  type EncounterActorForm,
  type EncounterActorProjectionFacts,
  type EncounterRunActorState,
  type EncounterRunState,
  type EncounterSourceProjectionFacts
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'
import {
  encounterFeatureReferenceDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  EncounterProjectionActorInput,
  EncounterProjectionCharacterStates,
  EncounterProjectionInput
} from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import {
  creatureQualifiedDamageDefenseDtoSchema,
  creatureSenseDtoSchema
} from '@artificer-toolkit/schema/subjects/creature'
import { speedDtoSchema } from '@artificer-toolkit/schema/shared/speed'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { snapshotCreatureEquipmentItems } from './encounterCreatureEquipmentSources.js'
import { snapshotFeatureDefinitions, stableActors } from './encounterActorState.js'
import type { MoraleActorFacts } from './optionalCombatPolicyCapability.js'
import {
  armorClassCapabilityRegistry,
  optionalCombatPolicyCapabilityRegistry
} from './platformEncounterPolicy.js'
import { requireEncounterActorRuleResult } from './encounterActorRuleOutput.js'
import { creatureInnateConditionRows } from './encounterInnateConditions.js'
import { encounterFacingRule } from './encounterFacing.js'
import { healthBand } from './encounterPlayerProjection.js'
import { validateInitiativeCursor } from './encounterInitiativeCursor.js'

export { projectPlayerEncounterProjection } from './encounterPlayerProjection.js'

/** Projects a current Run with its normalized initiative round already loaded. */
export function projectCurrentEncounterGm(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  rules: EncounterActorRuleOutput
  initiativeRoundState: EncounterInitiativeRoundStateDto | null
  characterStates: EncounterProjectionCharacterStates
}) {
  const { state, actors, rules, initiativeRoundState, characterStates } = input
  requireCurrentInitiativeRound(state, actors, initiativeRoundState)
  return projectGm({ ...state, actors, initiativeRoundState }, rules, characterStates)
}

/** Projects a current Run from its stored projection facts and its normalized initiative round. */
export function projectCurrentEncounterGmFacts(input: {
  state: EncounterRunState
  actors: readonly EncounterActorProjectionFacts[]
  sources: ReadonlyMap<string, EncounterSourceProjectionFacts>
  initiativeRoundState: EncounterInitiativeRoundStateDto | null
  characterStates: EncounterProjectionCharacterStates
}) {
  const { state, actors, sources, initiativeRoundState, characterStates } = input
  requireCurrentInitiativeRound(state, actors, initiativeRoundState)
  return projectGmFacts({ ...state, actors, initiativeRoundState }, sources, characterStates)
}

function requireCurrentInitiativeRound(
  state: EncounterRunState,
  actors: readonly { id: string; owner?: { ownerActorId: string } | null }[],
  initiativeRoundState: EncounterInitiativeRoundStateDto | null
) {
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
      actors,
      allowedSideIds: state.sides.map((side) => side.id)
    })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function snapshotStatBlock(actor: {
  kind: string
  systemId: string | null
  snapshot: unknown
}) {
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
  const naturalArmorBonus = payload.naturalArmorBonus
  // A Creature's armor class is computed from its effective loadout, so replacing or losing
  // armor or a shield in an Encounter changes it (D107).
  const armorClass =
    actor.systemId !== null &&
    abilities !== null &&
    typeof naturalArmorBonus === 'number' &&
    Number.isInteger(naturalArmorBonus) &&
    naturalArmorBonus >= 0
      ? armorClassCapabilityRegistry.require(actor.systemId).creatureArmorClass({
          abilityScores: abilities,
          naturalArmorBonus,
          equipment: snapshotCreatureEquipmentItems(actor).map(({ entry, source }) => ({
            id: entry.id,
            useState: entry.useState,
            compiled: source.compiled
          }))
        })
      : null
  if (armorClass && !armorClass.ok) throw new Error(armorClass.reason)
  return {
    armorClass: armorClass?.armorClass ?? null,
    abilityScores: abilities,
    // A malformed speed or sense fails the read rather than leaving the Creature without it.
    speeds: Array.isArray(payload.speeds)
      ? payload.speeds.map((entry) => speedDtoSchema.parse(entry))
      : [],
    senses: Array.isArray(payload.senses)
      ? payload.senses.map((entry) => creatureSenseDtoSchema.parse(entry))
      : [],
    damageVulnerabilities: stringValues(payload.damageVulnerabilities),
    damageResistances: stringValues(payload.damageResistances),
    damageImmunities: stringValues(payload.damageImmunities),
    qualifiedDamageDefenses: Array.isArray(payload.qualifiedDamageDefenses)
      ? payload.qualifiedDamageDefenses.flatMap((entry) => {
          const parsed = creatureQualifiedDamageDefenseDtoSchema.safeParse(entry)
          return parsed.success ? [parsed.data] : []
        })
      : [],
    conditionImmunities: stringValues(payload.conditionImmunities)
  }
}

function currentActorIdForProjection(
  encounter: Pick<
    EncounterProjectionInput,
    'currentActorId' | 'initiativeRoundState' | 'round' | 'status'
  > & {
    actors: readonly { id: string }[]
  }
): string | null {
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

/** The stat block a Character in a Creature form presents: the form's, with retained abilities baked in. */
export function characterFormStatBlock(
  actor: Pick<Extract<EncounterProjectionActorInput, { kind: 'CHARACTER' }>, 'systemId' | 'form'>
) {
  return actor.form === null
    ? null
    : snapshotStatBlock({
        kind: 'CREATURE',
        systemId: actor.systemId,
        snapshot: actor.form.snapshot
      })
}

/** The form as a stored actor holds it: the origin snapshot named by checksum, not carried. */
export function storedActorForm(form: EncounterActorForm | null) {
  if (form === null) return null
  const { snapshot, ...origin } = form.origin
  return { ...form, origin: { ...origin, snapshotChecksum: checksumCanonicalJson(snapshot) } }
}

/**
 * One actor's projection facts, from its state and its evaluated actor rules, and for a Creature the
 * stat block and Feature references its source shares with identical Creatures (ADR 0035
 * Amendment 12).
 */
export function projectEncounterActorFacts(
  actor: EncounterProjectionActorInput,
  actorRules: EncounterActorRuleOutput
): { facts: EncounterActorProjectionFacts; source: EncounterSourceProjectionFacts | null } {
  const shown = {
    id: actor.id,
    encounterId: actor.encounterId,
    sideId: actor.sideId,
    label: actor.label,
    public: actor.public,
    controllerUserIds: actor.controllerUserIds,
    ...(actor.owner && { owner: actor.owner }),
    disposition: actor.disposition,
    ...(actor.morale && { morale: actor.morale }),
    ...(actor.consequenceRollOffers && { consequenceRollOffers: actor.consequenceRollOffers }),
    initiative: actor.initiative,
    manualOrder: actor.manualOrder,
    healthDisplay: actor.healthDisplay,
    reveal: actor.reveal,
    systemId: actor.systemId,
    stableTieKey: actor.stableTieKey,
    resources: actor.resources,
    gmNotes: actor.gmNotes
  }
  if (actor.kind === 'CHARACTER')
    return {
      facts: encounterActorProjectionFactsSchema.parse({
        ...shown,
        kind: actor.kind,
        sourceId: actor.sourceId,
        frozenState: actor.frozenState,
        form: actor.form,
        absence: actor.absence
      }),
      source: null
    }
  const statBlock = snapshotStatBlock(actor)
  const features = snapshotFeatureDefinitions(actor).map((feature) =>
    encounterFeatureReferenceDtoSchema.parse({ ...feature, resource: null })
  )
  const source =
    statBlock === null && features.length === 0
      ? null
      : encounterSourceProjectionFactsSchema.parse({ statBlock, features })
  const resources = new Map(
    requireEncounterActorRuleResult(actorRules, actor.id).featureResources.map((resource) => [
      resource.featureId,
      resource
    ])
  )
  return {
    facts: encounterActorProjectionFactsSchema.parse({
      ...shown,
      kind: actor.kind,
      sourceId: actor.sourceId,
      sourceRevision: actor.sourceRevision,
      currentHitPoints: actor.currentHitPoints,
      maxHitPoints: actor.maxHitPoints,
      tempHitPoints: actor.tempHitPoints,
      conditions: [
        ...(Array.isArray(actor.conditions) ? actor.conditions : []),
        ...creatureInnateConditionRows(actor.snapshot)
      ],
      defeated: actor.defeated,
      form: storedActorForm(actor.form),
      absence: actor.absence,
      sourceFactsChecksum: source && checksumCanonicalJson(source),
      featureResources: [...resources.values()].flatMap((resource) =>
        resource.maximum === null
          ? []
          : [
              {
                featureId: resource.featureId,
                used: resource.used,
                maximum: resource.maximum,
                remaining: resource.remaining ?? 0,
                resetKind: resource.resetKind ?? 'MANUAL'
              }
            ]
      )
    }),
    source
  }
}

/** What morale triggers read of an actor; a Character's own health stays on its Sheet. */
export function moraleActorFacts(
  actor: EncounterActorProjectionFacts | EncounterRunActorState
): MoraleActorFacts {
  return actor.kind === 'CHARACTER'
    ? {
        actorId: actor.id,
        sideId: actor.sideId,
        kind: actor.kind,
        currentHitPoints: 0,
        maxHitPoints: 0,
        removed: actor.absence !== null,
        morale: null
      }
    : {
        actorId: actor.id,
        sideId: actor.sideId,
        kind: actor.kind,
        currentHitPoints: actor.currentHitPoints,
        maxHitPoints: actor.maxHitPoints,
        removed: actor.defeated || actor.absence !== null,
        morale: actor.morale ?? null
      }
}

/** Stored conditions are a type ID or a record holding one; the projection carries records. */
function conditionRows(conditions: unknown): unknown[] {
  return (Array.isArray(conditions) ? conditions : []).map((condition) =>
    typeof condition === 'string' ? { conditionTypeId: condition } : condition
  )
}

/** Character actors take hit points and conditions from the current Characters, never the Run. */
export function projectGm(
  encounter: EncounterProjectionInput,
  actorRules: EncounterActorRuleOutput,
  characterStates: EncounterProjectionCharacterStates
): EncounterGmProjectionDto {
  const projected = encounter.actors.map((actor) => projectEncounterActorFacts(actor, actorRules))
  return projectGmFacts(
    { ...encounter, actors: projected.map(({ facts }) => facts) },
    new Map(
      projected.flatMap(({ facts, source }) =>
        source && facts.kind !== 'CHARACTER' && facts.sourceFactsChecksum
          ? [[facts.sourceFactsChecksum, source] as const]
          : []
      )
    ),
    characterStates
  )
}

/**
 * The GM projection from the actors' projection facts and their sources' facts by checksum.
 * Character actors take hit points and conditions from the current Characters, never the Run.
 */
function projectGmFacts(
  encounter: Omit<EncounterProjectionInput, 'actors'> & {
    actors: readonly EncounterActorProjectionFacts[]
  },
  sources: ReadonlyMap<string, EncounterSourceProjectionFacts>,
  characterStates: EncounterProjectionCharacterStates
): EncounterGmProjectionDto {
  const moraleOffers =
    encounter.status === 'ACTIVE'
      ? (optionalCombatPolicyCapabilityRegistry.find(encounter.gameSystemId)?.offerMoraleTriggers({
          automationMode: encounter.automationMode,
          gameSystemId: encounter.gameSystemId,
          optionalCombatSnapshot: encounter.optionalCombatSnapshot ?? null,
          optionalCombatSnapshotChecksum: encounter.optionalCombatSnapshotChecksum,
          actors: encounter.actors.map(moraleActorFacts)
        }) ?? new Map())
      : new Map()
  return encounterGmProjectionDtoSchema.parse({
    id: encounter.id,
    campaignId: encounter.campaignId,
    gameSystemId: encounter.gameSystemId,
    blueprintId: encounter.blueprintId,
    blueprintVersion: encounter.blueprintVersion,
    blueprintChecksum: encounter.blueprintChecksum,
    name: encounter.name,
    status: encounter.status,
    automationMode: encounter.automationMode,
    trackAmmunition: encounter.trackAmmunition,
    zoneNoticing: encounter.zoneNoticing,
    healthDisplayDefault: encounter.healthDisplayDefault,
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
    facingStepDegrees:
      encounterFacingRule({
        automationMode: encounter.automationMode,
        gameSystemId: encounter.gameSystemId,
        optionalCombatSnapshot: encounter.optionalCombatSnapshot ?? null,
        optionalCombatSnapshotChecksum: encounter.optionalCombatSnapshotChecksum ?? null
      })?.facingStepDegrees ?? null,
    version: encounter.version,
    round: encounter.round,
    currentActorId: currentActorIdForProjection(encounter),
    actors: stableActors(encounter).flatMap((actor) => {
      const sheet = actor.kind === 'CHARACTER' ? characterStates.get(actor.sourceId) : undefined
      // A Character in a form shows the form's hit points; its conditions stay the Sheet's (D130).
      const current =
        actor.kind === 'CHARACTER'
          ? sheet &&
            (actor.form === null
              ? sheet
              : {
                  ...sheet,
                  current: actor.form.currentHitPoints,
                  temporary: actor.form.tempHitPoints,
                  maximum: actor.form.maxHitPoints,
                  dead: false
                })
          : {
              current: actor.currentHitPoints,
              temporary: actor.tempHitPoints,
              maximum: actor.maxHitPoints,
              conditions: actor.conditions,
              dead: false
            }
      // A Character without state is deleted and its actor awaits removal by the room (D74).
      if (!current) return []
      const source =
        actor.kind === 'CHARACTER' || actor.sourceFactsChecksum === null
          ? null
          : sources.get(actor.sourceFactsChecksum)
      if (source === undefined) throw new Error('Encounter actor source facts are unavailable.')
      const resources = new Map(
        actor.kind === 'CHARACTER'
          ? []
          : actor.featureResources.map(({ featureId, ...resource }) => [featureId, resource])
      )
      return {
        id: actor.id,
        encounterId: actor.encounterId,
        kind: actor.kind,
        label: actor.label,
        sourceId: actor.sourceId,
        sourceRevision: actor.kind === 'CHARACTER' ? null : actor.sourceRevision,
        systemId: actor.systemId,
        stableTieKey: actor.stableTieKey,
        public: actor.public,
        controllerUserIds: actor.controllerUserIds,
        ...(actor.owner && { owner: actor.owner }),
        disposition: actor.disposition,
        healthDisplay: actor.healthDisplay,
        reveal: actor.reveal,
        currentHitPoints: current.current,
        maxHitPoints: current.maximum,
        tempHitPoints: current.temporary,
        conditions: conditionRows(current.conditions),
        defeated: actor.kind === 'CHARACTER' ? current.dead : actor.defeated,
        absence: actor.absence,
        resources: actor.resources,
        gmNotes: actor.gmNotes,
        statBlock:
          (actor.kind === 'CHARACTER' ? characterFormStatBlock(actor) : source?.statBlock) ?? null,
        features: (source?.features ?? []).map((feature) => ({
          ...feature,
          resource: resources.get(feature.id) ?? null
        })),
        initiative: actor.initiative,
        manualOrder: actor.manualOrder,
        healthBand: healthBand(current.current, current.maximum),
        morale: actor.morale ?? null,
        moraleOffers: moraleOffers.get(actor.id) ?? [],
        consequenceRollOffers: actor.consequenceRollOffers ?? []
      }
    }),
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
