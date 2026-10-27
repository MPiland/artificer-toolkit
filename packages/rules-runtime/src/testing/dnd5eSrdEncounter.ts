import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import {
  encounterOptionalCombatSnapshotDtoSchema,
  type Dnd5eOptionalCombatReusableDefinitionDocumentDto,
  type Dnd5eOptionalCombatRuleKindDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  SRD_CONTENT_SOURCE,
  SRD_REUSABLE_DEFINITIONS,
  type SrdReusableDefinitionSeed
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { ProjectableCharacterFacts } from '../encounterActionProjection.js'
import { buildEncounterActorRuleFacts } from '../encounterActorRuleFacts.js'
import { pinCreatureEquipmentSources } from '../encounterCreatureEquipmentSources.js'
import { reconcileEncounterActorRuleOutput } from '../encounterActorRuleOutput.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import {
  compileInstalledCreatureRuleFacts,
  createPlatformRulesRuntime,
  evaluateInstalledEncounterActors
} from '../platformRulesRuntime.js'
import type { CurrentReusableDefinitionSource } from '../ruleCapabilityStateService.js'
import { storedEquipmentSource } from './storedEquipmentSource.js'

export { SRD_SYSTEM_ID }

/** A canonical, deterministic UUID for test identities. */
export function testUuid(value: number) {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`
}

export const ENCOUNTER_ID = '00000000-0000-4000-8000-00000000e000'
/** The side every fixture actor is on unless it names another. */
export const SIDE_ID = '00000000-0000-4000-8000-00000000e001'
export const CAMPAIGN_ID = '00000000-0000-4000-8000-00000000e004'
export const TIMESTAMP = '2026-09-26T00:00:00.000Z'
const SOURCE_VERSION_ID = '00000000-0000-4000-8000-00000000e002'
const PUBLISHER_ID = '00000000-0000-4000-8000-00000000e003'
const VOCABULARY_SNAPSHOT_ID = '00000000-0000-4000-8000-00000000e005'

type Ability = keyof typeof SRD_ABILITY_DEFINITION_IDS

const seedsById = new Map(SRD_REUSABLE_DEFINITIONS.map((seed) => [seed.id, seed]))

const srdEquipmentById = new Map(srdEquipment.map((document) => [document.id, document]))

/** A Creature's loadout Equipment served as current version-1 SRD records with stored compilations. */
function srdLoadoutEquipmentRecords(creature: CreatureAuthored) {
  return new Map(
    (creature.equipmentLoadout ?? []).map(({ equipmentId }) => {
      const document = srdEquipmentById.get(equipmentId)
      if (!document) throw new Error(`SRD Equipment "${equipmentId}" is missing.`)
      return [
        equipmentId,
        storedEquipmentSource(document, (id) => srdEquipmentById.get(id), {
          versionId: SOURCE_VERSION_ID
        })
      ] as const
    })
  )
}

/** A reusable definition served as a current version-1 SRD record. */
export function currentSrdDefinition(seed: SrdReusableDefinitionSeed) {
  return reusableDefinitionCurrentDtoSchema.parse({
    ...seed,
    gameSystemId: SRD_SYSTEM_ID,
    contentSourceId: SRD_CONTENT_SOURCE.id,
    contractVersion: 1,
    version: 1,
    publishedAt: TIMESTAMP,
    publishedBy: PUBLISHER_ID
  })
}

/** The published SRD reusable definitions, served as current version-1 records. */
export const srdDefinitions: CurrentReusableDefinitionSource = {
  async requireCurrent(definitionId) {
    const seed = seedsById.get(definitionId)
    if (!seed) throw new Error(`SRD definition "${definitionId}" is missing.`)
    return currentSrdDefinition(seed)
  }
}

/** The installed platform runtime; resolved or frozen graphs are passed in, so its source is unused. */
export function createSrdRulesRuntime() {
  return createPlatformRulesRuntime({
    definitions: {
      requireCurrent() {
        throw new Error('The pure rules test runtime resolves no definitions itself.')
      }
    }
  })
}

const vocabularyIdentity = {
  snapshotId: VOCABULARY_SNAPSHOT_ID,
  systemId: srdSystemRecord.id,
  snapshotVersion: 1,
  schemaVersion: 1,
  document: srdSystemRecord
}

/** The SRD vocabulary snapshot, built the way Convex pins the current System document. */
export const SRD_VOCABULARY = systemVocabularySnapshotSchema.parse({
  ...vocabularyIdentity,
  checksum: checksumCanonicalJson(vocabularyIdentity)
})

export function srdCondition(label: string): string {
  const condition = SRD_CONDITION_TYPES.find((entry) => entry.label === label)
  if (!condition) throw new Error(`SRD condition "${label}" is missing.`)
  return condition.id
}

export function creatureFeature(creature: CreatureAuthored, label: string) {
  const feature = creature.features.find((entry) => entry.label === label)
  if (!feature) throw new Error(`SRD ${creature.label} Feature "${label}" is missing.`)
  return feature
}

/**
 * An SRD Creature as a Run actor, snapshotted the way Blueprint creation freezes it: explicit empty
 * defense lists, the installed System's compiled rule facts and its pinned Equipment loadout.
 */
export function srdCreatureActor(input: {
  id: string
  creature: CreatureAuthored
  featureCharges?: Readonly<Record<string, number>>
  conditionIds?: readonly string[]
  currentHitPoints?: number
  tempHitPoints?: number
  defeated?: boolean
  damageTypesSinceTurnStart?: { damageTypeId: string; commandId: string }[]
  initiative?: number | null
  manualOrder?: number | null
  sideId?: string
  disposition?: EncounterRunActorState['disposition']
}): EncounterRunActorState {
  const { creature } = input
  const equipmentSources = pinCreatureEquipmentSources({
    creature,
    equipment: srdLoadoutEquipmentRecords(creature)
  })
  return encounterRunActorStateSchema.parse({
    id: input.id,
    encounterId: ENCOUNTER_ID,
    kind: 'CREATURE',
    label: creature.label,
    sourceId: creature.id,
    sourceRevision: 1,
    public: true,
    controllerUserIds: [],
    disposition: input.disposition ?? 'HOSTILE',
    initiative: input.initiative ?? null,
    manualOrder: input.manualOrder ?? null,
    form: null,
    absence: null,
    healthDisplay: null,
    systemId: creature.systemId,
    stableTieKey: input.id,
    gmNotes: null,
    sideId: input.sideId ?? SIDE_ID,
    currentHitPoints: input.currentHitPoints ?? creature.hitPoints,
    maxHitPoints: creature.hitPoints,
    tempHitPoints: input.tempHitPoints ?? 0,
    conditions: [...(input.conditionIds ?? [])],
    defeated: input.defeated ?? false,
    ...(input.damageTypesSinceTurnStart && {
      damageTypesSinceTurnStart: input.damageTypesSinceTurnStart
    }),
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
      payload: creature,
      ruleFacts: compileInstalledCreatureRuleFacts({ creature, vocabulary: SRD_VOCABULARY }),
      ...(equipmentSources.length > 0 ? { equipmentSources } : {})
    },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
}

/**
 * An SRD Creature as the installed System stores it: damage defenses and condition immunities
 * resolved to vocabulary identities. A raw stat block carries labels, which leave the Run actor's
 * target protection unnormalized.
 */
export function installedSrdCreature(raw: CreatureAuthored): CreatureAuthored {
  const installed = srdBaselineContent.subjects.creatures.find((entry) => entry.id === raw.id)
  if (!installed) throw new Error(`SRD Creature "${raw.label}" is not installed.`)
  return installed
}

/** Hand-written normalized Creature rule facts, for scalar arithmetic independent of any stat block. */
export function creatureRuleFacts(scores: Record<Ability, number>) {
  return {
    gameSystemId: SRD_SYSTEM_ID,
    vocabularySnapshotId: VOCABULARY_SNAPSHOT_ID,
    vocabularySnapshotVersion: 1,
    vocabularySnapshotChecksum: 'b'.repeat(64),
    abilityScores: Object.fromEntries(
      Object.entries(scores).map(([code, score]) => [
        SRD_ABILITY_DEFINITION_IDS[code as Ability],
        score
      ])
    ),
    saveProficiencyBonuses: {},
    resourceAbilityScores: {},
    initiativeAbilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
    modifiers: []
  }
}

/** A Run-owned Creature or custom actor carrying exactly the given Blueprint snapshot. */
export function creatureActor(input: {
  id: string
  kind?: 'CREATURE' | 'CUSTOM'
  snapshot: Record<string, unknown>
  currentHitPoints?: number
  maxHitPoints?: number
  tempHitPoints?: number
  conditions?: unknown[]
  defeated?: boolean
  disposition?: EncounterRunActorState['disposition']
}): EncounterRunActorState {
  return encounterRunActorStateSchema.parse({
    id: input.id,
    encounterId: ENCOUNTER_ID,
    kind: input.kind ?? 'CREATURE',
    label: 'Bandit',
    sourceId: null,
    sourceRevision: null,
    public: true,
    controllerUserIds: [],
    disposition: input.disposition ?? 'HOSTILE',
    initiative: null,
    manualOrder: null,
    form: null,
    absence: null,
    healthDisplay: null,
    systemId: SRD_SYSTEM_ID,
    stableTieKey: input.id,
    currentHitPoints: input.currentHitPoints ?? 11,
    maxHitPoints: input.maxHitPoints ?? 11,
    tempHitPoints: input.tempHitPoints ?? 0,
    conditions: input.conditions ?? [],
    defeated: input.defeated ?? false,
    resources: {},
    gmNotes: null,
    sideId: SIDE_ID,
    snapshot: input.snapshot,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
}

/** A Run actor for a Character; its hit points and conditions live on the Character (ADR 0034). */
export function characterActor(input: { id: string; characterId: string }): EncounterRunActorState {
  return encounterRunActorStateSchema.parse({
    id: input.id,
    encounterId: ENCOUNTER_ID,
    kind: 'CHARACTER',
    label: 'Aria',
    sourceId: input.characterId,
    frozenState: null,
    absence: null,
    form: null,
    public: true,
    controllerUserIds: [],
    disposition: 'FRIENDLY',
    initiative: null,
    manualOrder: null,
    healthDisplay: null,
    systemId: SRD_SYSTEM_ID,
    stableTieKey: input.id,
    resources: {},
    gmNotes: null,
    sideId: SIDE_ID,
    snapshot: { kind: 'CHARACTER', systemId: SRD_SYSTEM_ID, id: input.characterId },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
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

/**
 * Selected SRD optional combat rules, pinned as an Encounter snapshot and its checksum; `homebrew`
 * rewrites each seeded document as a GM's copy would, under its recomputed checksum.
 */
export function srdOptionalCombat(
  kinds: readonly Dnd5eOptionalCombatRuleKindDto[],
  homebrew?: (
    document: Dnd5eOptionalCombatReusableDefinitionDocumentDto
  ) => Dnd5eOptionalCombatReusableDefinitionDocumentDto
) {
  const snapshot = encounterOptionalCombatSnapshotDtoSchema.parse({
    schemaVersion: 1,
    gameSystemId: SRD_SYSTEM_ID,
    definitions: kinds.map((kind) => {
      const seed = SRD_OPTIONAL_COMBAT_DEFINITIONS.find((entry) => entry.document.kind === kind)
      if (!seed) throw new Error(`SRD optional combat rule "${kind}" is missing.`)
      const document = homebrew ? homebrew(seed.document) : seed.document
      return {
        definitionId: seed.id,
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitionVersion: 1,
        definitionChecksum: homebrew ? checksumRuleDocument(document) : seed.checksum,
        contractVersion: 1,
        label: seed.label,
        document
      }
    })
  })
  return { snapshot, checksum: checksumRuleDocument(snapshot) }
}

/** An SRD Encounter Run; active in round 1 unless a status and round are given. */
export function srdEncounterState(input: {
  actors: readonly EncounterRunActorState[]
  currentActorId: string | null
  status?: EncounterRunState['status']
  round?: number
  version?: number
  turnSequence?: number
  automationMode?: AutomationModeDto
  trackAmmunition?: boolean
  zoneNoticing?: EncounterRunState['zoneNoticing']
  automaticCover?: boolean
  initiativePolicy?: { snapshot: EncounterInitiativePolicySnapshotDto; checksum: string }
  optionalCombatKinds?: readonly Dnd5eOptionalCombatRuleKindDto[]
  optionalCombatHomebrew?: Parameters<typeof srdOptionalCombat>[1]
  sides?: readonly { id: string; label: string }[]
}): EncounterRunState {
  const optionalCombat = srdOptionalCombat(
    input.optionalCombatKinds ?? [],
    input.optionalCombatHomebrew
  )
  return encounterRunStateSchema.parse({
    id: ENCOUNTER_ID,
    campaignId: CAMPAIGN_ID,
    gameSystemId: SRD_SYSTEM_ID,
    blueprintId: '00000000-0000-4000-8000-00000000e006',
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    name: 'Pure rules fixture',
    status: input.status ?? 'ACTIVE',
    automationMode: input.automationMode ?? 'ASSISTED',
    trackAmmunition: input.trackAmmunition ?? false,
    zoneNoticing: input.zoneNoticing ?? 'GM_PROMPT',
    automaticCover: input.automaticCover ?? true,
    healthDisplayDefault: 'HIDDEN',
    version: input.version ?? 7,
    round: input.round ?? 1,
    currentActorId: input.currentActorId,
    actorIds: input.actors.map((actor) => actor.id),
    initiativePolicySnapshot: input.initiativePolicy?.snapshot ?? null,
    initiativePolicySnapshotChecksum: input.initiativePolicy?.checksum ?? null,
    optionalCombatSnapshot: optionalCombat.snapshot,
    optionalCombatSnapshotChecksum: optionalCombat.checksum,
    turnSequence: input.turnSequence ?? 1,
    sides: (input.sides ?? [{ id: SIDE_ID, label: 'Monsters' }]).map((side, sortOrder) => ({
      ...side,
      sortOrder
    })),
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  })
}

/** A Creature's rules target, built from its snapshot and active effects as the Encounter builds it. */
export function srdCreatureTarget(
  actor: EncounterRunActorState,
  activeEffects: ActiveRuleEffectRecord[] = []
) {
  return buildMovementTarget<ProjectableCharacterFacts>({
    actor,
    activeEffects,
    characterFacts: null,
    campaignId: CAMPAIGN_ID,
    gameSystemId: SRD_SYSTEM_ID
  })
}
