import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import {
  encounterOptionalCombatSnapshotDtoSchema,
  type Dnd5eOptionalCombatRuleKindDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  SRD_CONTENT_SOURCE,
  SRD_REUSABLE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import {
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildEncounterActorRuleFacts } from '../encounterActorRuleFacts.js'
import { reconcileEncounterActorRuleOutput } from '../encounterActorRuleOutput.js'
import type { MovementTarget } from '../encounterMovementTargets.js'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey,
  evaluateInstalledEncounterActors
} from '../platformRulesRuntime.js'
import type { CurrentReusableDefinitionSource } from '../ruleCapabilityStateService.js'

export { SRD_SYSTEM_ID }

const ENCOUNTER_ID = '00000000-0000-4000-8000-00000000e000'
const SIDE_ID = '00000000-0000-4000-8000-00000000e001'
const SOURCE_VERSION_ID = '00000000-0000-4000-8000-00000000e002'
const PUBLISHER_ID = '00000000-0000-4000-8000-00000000e003'
const AT = '2026-09-26T00:00:00.000Z'

const seedsById = new Map(SRD_REUSABLE_DEFINITIONS.map((seed) => [seed.id, seed]))

/** The published SRD reusable definitions, served as current version-1 records. */
export const srdDefinitions: CurrentReusableDefinitionSource = {
  async requireCurrent(definitionId) {
    const seed = seedsById.get(definitionId)
    if (!seed) throw new Error(`SRD definition "${definitionId}" is missing.`)
    return reusableDefinitionCurrentDtoSchema.parse({
      ...seed,
      gameSystemId: SRD_SYSTEM_ID,
      contentSourceId: SRD_CONTENT_SOURCE.id,
      contractVersion: 1,
      version: 1,
      publishedAt: AT,
      publishedBy: PUBLISHER_ID
    })
  }
}

/** The installed platform runtime; resolved graphs are passed in, so its own source is unused. */
export async function createSrdRulesRuntime() {
  return createPlatformRulesRuntime({
    continuationIntegrityKey: await deriveRulesContinuationKey(
      'artificer-toolkit pure rules test continuation secret'
    ),
    definitions: {
      requireCurrent() {
        throw new Error('The pure rules test runtime resolves no definitions itself.')
      }
    }
  })
}

export function srdCondition(label: string): string {
  const condition = SRD_CONDITION_TYPES.find((entry) => entry.label === label)
  if (!condition) throw new Error(`SRD condition "${label}" is missing.`)
  return condition.id
}

export function creatureFeature(creature: CreatureAuthored, label: string) {
  const feature = creature.features?.find((entry) => entry.label === label)
  if (!feature) throw new Error(`SRD ${creature.label} Feature "${label}" is missing.`)
  return feature
}

/** An SRD Creature as a Run actor, snapshotted the way Blueprint creation freezes it. */
export function srdCreatureActor(input: {
  id: string
  creature: CreatureAuthored
  featureCharges?: Readonly<Record<string, number>>
  conditionIds?: readonly string[]
  currentHitPoints?: number
  tempHitPoints?: number
}): EncounterRunActorState {
  const { creature } = input
  return encounterRunActorStateSchema.parse({
    id: input.id,
    encounterId: ENCOUNTER_ID,
    kind: 'CREATURE',
    label: creature.label,
    sourceId: creature.id,
    sourceRevision: 1,
    public: true,
    controllerUserIds: [],
    disposition: 'HOSTILE',
    initiative: null,
    manualOrder: null,
    healthDisplay: null,
    systemId: creature.systemId,
    stableTieKey: input.id,
    gmNotes: null,
    sideId: SIDE_ID,
    currentHitPoints: input.currentHitPoints ?? creature.hitPoints,
    maxHitPoints: creature.hitPoints,
    tempHitPoints: input.tempHitPoints ?? 0,
    conditions: [...(input.conditionIds ?? [])],
    resources: input.featureCharges ? { featureCharges: { ...input.featureCharges } } : {},
    snapshot: {
      kind: 'CREATURE',
      id: creature.id,
      label: creature.label,
      systemId: creature.systemId,
      sourceRevision: 1,
      sourceVersionId: SOURCE_VERSION_ID,
      sourceChecksum: checksumRuleDocument(creature),
      maxHitPoints: creature.hitPoints,
      payload: creature
    },
    createdAt: AT,
    updatedAt: AT
  })
}

/** The installed D&D Encounter actor policy output (Feature pools and saves) for these actors. */
export function srdActorRules(actors: readonly EncounterRunActorState[]) {
  const facts = buildEncounterActorRuleFacts({ actors })
  return reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: SRD_SYSTEM_ID, facts }),
    facts
  )
}

/** Selected SRD optional combat rules, pinned as an Encounter snapshot and its checksum. */
export function srdOptionalCombat(kinds: readonly Dnd5eOptionalCombatRuleKindDto[]) {
  const snapshot = encounterOptionalCombatSnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: SRD_SYSTEM_ID,
    definitions: kinds.map((kind) => {
      const seed = SRD_OPTIONAL_COMBAT_DEFINITIONS.find((entry) => entry.document.kind === kind)
      if (!seed) throw new Error(`SRD optional combat rule "${kind}" is missing.`)
      return {
        definitionId: seed.id,
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitionVersion: 1,
        definitionChecksum: seed.checksum,
        contractVersion: 1,
        label: seed.label,
        document: seed.document
      }
    })
  })
  return { snapshot, checksum: checksumRuleDocument(snapshot) }
}

export function srdEncounterState(input: {
  actors: readonly EncounterRunActorState[]
  currentActorId: string | null
  automationMode?: AutomationModeDto
  optionalCombatKinds?: readonly Dnd5eOptionalCombatRuleKindDto[]
}): EncounterRunState {
  const optionalCombat = srdOptionalCombat(input.optionalCombatKinds ?? [])
  return encounterRunStateSchema.parse({
    id: ENCOUNTER_ID,
    campaignId: '00000000-0000-4000-8000-00000000e004',
    gameSystemId: SRD_SYSTEM_ID,
    blueprintId: '00000000-0000-4000-8000-00000000e005',
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    name: 'Pure rules fixture',
    status: 'ACTIVE',
    automationMode: input.automationMode ?? 'ASSISTED',
    manualReminderMode: 'OFF',
    healthDisplayDefault: 'HIDDEN',
    version: 7,
    round: 1,
    currentActorId: input.currentActorId,
    actorIds: input.actors.map((actor) => actor.id),
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot: optionalCombat.snapshot,
    optionalCombatSnapshotChecksum: optionalCombat.checksum,
    turnSequence: 1,
    sides: [{ id: SIDE_ID, label: 'Monsters', sortOrder: 0 }],
    createdAt: AT,
    updatedAt: AT
  })
}

/** A Creature's locked rules target with no active effects. */
export function srdCreatureTarget(actor: EncounterRunActorState): MovementTarget {
  if (actor.kind === 'CHARACTER') throw new Error('A Creature target needs a Creature actor.')
  return {
    characterFacts: null,
    actor,
    activeEffects: [],
    state: {
      current: actor.currentHitPoints,
      temporary: actor.tempHitPoints,
      conditions: []
    },
    initialConditionRows: null,
    effectiveMaximumHitPoints: actor.maxHitPoints,
    baseScalarValues: {},
    effectiveScalarValues: {},
    baseRulePolicyOutput: null,
    effectiveRulePolicyOutput: null,
    targetDerivedFacts: {},
    defenses: [],
    qualifiedDefenses: [],
    conditionImmunityIds: [],
    characterCurrentness: null
  }
}
