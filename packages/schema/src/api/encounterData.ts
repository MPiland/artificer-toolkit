import { z, lazySchema } from '../zod.js'

import { automationModeDtoSchema, zoneNoticingModeDtoSchema } from './campaignSettings.js'
import { featureReferenceDtoSchema } from '../features/reference.js'
import {
  creatureQualifiedDamageDefenseDtoSchema,
  creatureSenseDtoSchema
} from '../subjects/creature.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { speedDtoSchema } from '../shared/speed.js'
import {
  MAX_TURN_TELEPORT_ALLOWANCES,
  teleportAllowanceDtoSchema
} from '../shared/teleportAllowance.js'
import { encounterInitiativePolicySummaryDtoSchema } from '../shared/initiativePolicySnapshot.js'
import {
  encounterOptionalCombatSummaryDtoSchema,
  facingArcTableDtoSchema,
  facingStepDegreesDtoSchema
} from '../shared/optionalCombat.js'
import {
  encounterActorMoraleDtoSchema,
  encounterMoraleOfferDtoSchema
} from '../shared/encounterMorale.js'
import { encounterConsequenceRollOffersDtoSchema } from '../shared/consequenceRolls.js'
import {
  encounterRuleOccurrenceSummaryDtoSchema,
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type EncounterRuleOccurrenceSummaryDto,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '../shared/encounterRuleOccurrence.js'
import {
  AUTHORED_LIMITS,
  MAX_ENCOUNTER_ACTORS,
  authoredIdentifierSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import {
  activeGrantListingDtoSchema,
  concealmentListingDtoSchema,
  concentrationListingDtoSchema
} from '../shared/activeGrantListing.js'
import { jsonValueSchema } from '../projections/identity.js'
import { encounterBlueprintMetadataDtoSchema } from '../shared/encounterBlueprint.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import { rollRecordDtoSchema } from './rolls.js'
import { d20AddedFacesDtoSchema } from '../shared/d20AddedDice.js'
import { healthDisplayLevelDtoSchema, playerActorHealthDtoSchema } from './healthDisplay.js'
import {
  MAX_SPATIAL_RULE_EFFECTS_PER_SCENE,
  spatialGeometryDtoSchema,
  spatialPersistedGeometryDtoSchema,
  spatialPositiveDistanceDtoSchema,
  zoneDcDtoSchema,
  zoneMovementCostMultiplierSchema
} from '../shared/spatial.js'
import {
  rollModeKeepFaceCount,
  rollModeKeepSchema,
  systemCoreCodeSchema
} from '../shared/systemCoreCode.js'

const uuidSchema = lazySchema(() => z.string().check(z.uuid()))
const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
const timestampSchema = lazySchema(() => z.iso.datetime())
const jsonSchema = z.json()

export { automationModeDtoSchema as encounterAutomationModeDtoSchema }

export const encounterStatusDtoSchema = lazySchema(() =>
  z.enum(['PREPARED', 'ACTIVE', 'COMPLETED'])
)
export const encounterActorKindDtoSchema = lazySchema(() =>
  z.enum(['CHARACTER', 'CREATURE', 'CUSTOM'])
)
export { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
export const encounterHealthBandDtoSchema = lazySchema(() =>
  z.enum(['HEALTHY', 'WOUNDED', 'BLOODIED', 'CRITICAL'])
)

/** Foundry-style token disposition; target warnings and flanking relationships compare it. */
export const encounterActorDispositionDtoSchema = lazySchema(() =>
  z.enum(['FRIENDLY', 'NEUTRAL', 'HOSTILE'])
)
export type EncounterActorDispositionDto = z.infer<typeof encounterActorDispositionDtoSchema>

/**
 * Why an actor is out of the Run's play (D82, D128, D178): taken out by the GM, carried away by an
 * effect for good (`DEPARTED`), or held out of play by an effect that returns it when it ends
 * (`EFFECT`; `EFFECT_KEEPS_TURN` when initiative still gives it turns, Etherealness).
 */
export const encounterActorAbsenceDtoSchema = lazySchema(() =>
  z.enum(['GM_REMOVED', 'DEPARTED', 'EFFECT', 'EFFECT_KEEPS_TURN'])
)
export type EncounterActorAbsenceDto = z.infer<typeof encounterActorAbsenceDtoSchema>

export const MAX_ENCOUNTER_ACTOR_CONTROLLERS = 8

/**
 * GM-granted controllers of one Run actor (ADR 0034 decision 1). A Character actor's assigned player
 * is always a controller too; that derived control is never stored here.
 */
export const encounterActorControllerUserIdsDtoSchema = lazySchema(() =>
  z
    .array(uuidSchema)
    .check(z.maxLength(MAX_ENCOUNTER_ACTOR_CONTROLLERS))
    .check(
      z.superRefine((userIds, context) => {
        if (userIds.some((userId, index) => index > 0 && userIds[index - 1]! >= userId))
          context.addIssue({
            code: 'custom',
            message: 'Actor controllers must be unique and sorted.'
          })
      })
    )
)

/**
 * The actor that commands this one. Control is derived from it, never copied onto the owned actor
 * (`actorOwnerChain`): whoever controls the owner controls the owned actor. `sourceEffectId` is the
 * active effect that created it (a summon spell); a pet or companion no effect created omits it.
 * `turnTiming` is when a summon authored to act apart from its owner's turn takes it (D200); absent
 * means on the owner's turn.
 */
export const encounterActorOwnerDtoSchema = lazySchema(() =>
  z.strictObject({
    ownerActorId: uuidSchema,
    sourceEffectId: z.optional(uuidSchema),
    turnTiming: z.optional(z.enum(['AFTER_OWNER', 'OWN_INITIATIVE']))
  })
)

export type EncounterActorOwnerDto = z.infer<typeof encounterActorOwnerDtoSchema>

/**
 * The GM's per-actor reveal (ATTACK-17.3): a public actor whose token a player cannot see is
 * listed to that player only when revealed, as an "Unseen creature" (`UNNAMED`) or by name (`NAMED`).
 * It never draws the token. GM-only; the player projection carries no trace of it.
 */
export const encounterActorRevealDtoSchema = lazySchema(() => z.enum(['UNNAMED', 'NAMED']))

/**
 * A condition an actor holds, by its System condition type ID alone: web names it from the System
 * vocabulary (ADR 0039), so the projection never reads the System document. `innate` marks a
 * condition part of the Creature, not removable.
 */
const encounterActorConditionDtoSchema = lazySchema(() =>
  z.object({
    conditionTypeId: postgresUuidSchema,
    notes: z.optional(z.string()),
    /** A leveled condition's level (Exhaustion), from 1 to its System maximum; absent is level 1. */
    level: z.optional(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20))),
    innate: z.optional(z.literal(true))
  })
)

const encounterActorBaseDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    encounterId: uuidSchema,
    kind: encounterActorKindDtoSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    sourceId: z.nullable(postgresUuidSchema),
    sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
    public: z.boolean(),
    controllerUserIds: encounterActorControllerUserIdsDtoSchema,
    /** The actor that commands this one (summon, pet, companion, minion); absent for an independent actor. */
    owner: z.optional(encounterActorOwnerDtoSchema),
    disposition: encounterActorDispositionDtoSchema,
    initiative: z.nullable(z.number().check(z.int())),
    manualOrder: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
    conditions: z.array(encounterActorConditionDtoSchema),
    /** Active grants with their source and time left; a hidden source's label is null for players (D99). */
    activeGrants: z._default(z.array(activeGrantListingDtoSchema), []),
    /**
     * The Concentration this actor maintains, for its controllers and the GM (SPELLS-5.11); null for
     * everyone else and for an actor not concentrating. A hidden source's label is null for players.
     */
    concentration: z._default(z.nullable(concentrationListingDtoSchema), null),
    /**
     * A Creature or custom actor reduced to 0 hit points (D63): it keeps its initiative place but takes
     * no turns, actions or reactions until it regains hit points. Always false for a Character, which
     * falls unconscious and dying instead.
     */
    defeated: z.boolean(),
    /**
     * Why the actor is out of the Run's play, or null while it plays (D82, amended by D128): a
     * Character the GM took out of initiative (`GM_REMOVED`; it keeps its place in the Run, its Sheet
     * play and what the Run applied to it), or an actor an effect carried away (`DEPARTED`; Word of
     * Recall, Plane Shift). Initiative skips an absent actor's turns and its Scene token is hidden
     * until the GM returns it.
     */
    absence: z.nullable(encounterActorAbsenceDtoSchema)
  })
)

/**
 * A player sees another actor's health only at its display level (ADR 0034 decision 5): a
 * Character's level is its player's "Show my health to the party", an enemy's or NPC's is its GM
 * override or the Encounter default. `null` is Hidden.
 */
export const encounterPlayerActorDtoSchema = lazySchema(() =>
  z.extend(encounterActorBaseDtoSchema, {
    health: z.nullable(playerActorHealthDtoSchema),
    /**
     * Why a listed actor is not drawn for the player (D131): `INVISIBLE` when it carries the Invisible
     * condition, otherwise `HIDDEN` (hidden, in fog or unbound). Null for an actor the player sees or controls.
     */
    unseenReason: z.nullable(z.enum(['HIDDEN', 'INVISIBLE']))
  })
)

export const encounterFeatureResourceDtoSchema = lazySchema(() =>
  z.strictObject({
    used: z.number().check(z.int()).check(z.nonnegative()),
    maximum: z.number().check(z.int()).check(z.nonnegative()),
    remaining: z.number().check(z.int()).check(z.nonnegative()),
    resetKind: z.enum(['DAILY', 'DAWN', 'DUSK', 'LONG_REST', 'SHORT_REST', 'MANUAL'])
  })
)

export const encounterFeatureReferenceDtoSchema = lazySchema(() =>
  z.extend(
    z.pick(featureReferenceDtoSchema, {
      id: true,
      label: true,
      description: true,
      section: true,
      rollDefinitions: true
    }),
    {
      resource: z._default(z.nullable(encounterFeatureResourceDtoSchema), null)
    }
  )
)

export const encounterGmActorDtoSchema = lazySchema(() =>
  z.extend(encounterActorBaseDtoSchema, {
    healthBand: encounterHealthBandDtoSchema,
    /** GM override of the Encounter's health display default; Character actors use their Sheet's. */
    healthDisplay: z.nullable(healthDisplayLevelDtoSchema),
    /** GM reveal of a public actor the players cannot see; null is not revealed. */
    reveal: z._default(z.nullable(encounterActorRevealDtoSchema), null),
    systemId: z.nullable(postgresUuidSchema),
    stableTieKey: z.string().check(z.minLength(1)),
    currentHitPoints: z.number().check(z.int()).check(z.nonnegative()),
    maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
    tempHitPoints: z.number().check(z.int()).check(z.nonnegative()),
    resources: jsonSchema,
    gmNotes: z.nullable(z.string().check(z.maxLength(4000))),
    statBlock: z.nullable(
      z.strictObject({
        armorClass: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
        abilityScores: z.nullable(z.record(z.string(), z.number())),
        speeds: z.array(speedDtoSchema),
        senses: z.array(creatureSenseDtoSchema),
        damageVulnerabilities: z.array(z.string()),
        damageResistances: z.array(z.string()),
        damageImmunities: z.array(z.string()),
        /** "From nonmagical attacks" defenses, kept apart from the unconditional ones. */
        qualifiedDamageDefenses: z.array(creatureQualifiedDamageDefenseDtoSchema),
        conditionImmunities: z.array(z.string())
      })
    ),
    features: z._default(z.array(encounterFeatureReferenceDtoSchema), []),
    /**
     * The concealment this actor holds and who it is hidden from (D116); GM-only, so the player
     * actor contract has no such field. Null when the actor is not hidden.
     */
    concealment: z._default(z.nullable(concealmentListingDtoSchema), null),
    /** The actor's latest morale check (ENCOUNTER-6.2); GM-only. Null when none was made. */
    morale: z._default(z.nullable(encounterActorMoraleDtoSchema), null),
    /** The morale triggers the GM may check for this actor now (ENCOUNTER-6.1). */
    moraleOffers: z._default(z.array(encounterMoraleOfferDtoSchema).check(z.maxLength(8)), []),
    /** The consequence-table rolls the GM may accept or decline for this actor (ATTACK-15). */
    consequenceRollOffers: z._default(encounterConsequenceRollOffersDtoSchema, [])
  })
)

export const encounterPlayerProjectionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    gameSystemId: postgresUuidSchema,
    blueprintId: postgresUuidSchema,
    blueprintVersion: z.number().check(z.int()).check(z.positive()),
    blueprintChecksum: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
    name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    status: encounterStatusDtoSchema,
    automationMode: automationModeDtoSchema,
    initiativePolicy: z._default(z.nullable(encounterInitiativePolicySummaryDtoSchema), null),
    optionalCombatRules: z._default(
      z.array(encounterOptionalCombatSummaryDtoSchema).check(z.maxLength(14)),
      []
    ),
    /** The step a token's facing turns by while the Facing rule is active (ATTACK-12); null when it is off. */
    facingStepDegrees: z._default(z.nullable(facingStepDegreesDtoSchema), null),
    /** The Facing rule's arcs, which the tabletop draws around a token; null when the rule is off. */
    facingArcs: z._default(z.nullable(facingArcTableDtoSchema), null),
    version: z.number().check(z.int()).check(z.nonnegative()),
    round: z.number().check(z.int()).check(z.nonnegative()),
    currentActorId: z.nullable(uuidSchema),
    actors: z.array(encounterPlayerActorDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
)

export const encounterGmProjectionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    gameSystemId: postgresUuidSchema,
    blueprintId: postgresUuidSchema,
    blueprintVersion: z.number().check(z.int()).check(z.positive()),
    blueprintChecksum: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
    name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    status: encounterStatusDtoSchema,
    automationMode: automationModeDtoSchema,
    /** Frozen from the Campaign at Run start: ammunition attacks draw pieces from the chosen stack. */
    trackAmmunition: z._default(z.boolean(), false),
    /** Frozen from the Campaign at Run start: how concealed zones are noticed (MOVE-3.5). */
    zoneNoticing: z._default(zoneNoticingModeDtoSchema, 'GM_PROMPT'),
    /** Frozen from the Campaign at Run start: cover is worked out from the Scene for attacks and area saves. */
    automaticCover: z._default(z.boolean(), true),
    /** What players see of enemies' and NPCs' health unless an actor overrides it. */
    healthDisplayDefault: healthDisplayLevelDtoSchema,
    initiativePolicy: z._default(z.nullable(encounterInitiativePolicySummaryDtoSchema), null),
    optionalCombatRules: z._default(
      z.array(encounterOptionalCombatSummaryDtoSchema).check(z.maxLength(14)),
      []
    ),
    /** The step a token's facing turns by while the Facing rule is active (ATTACK-12); null when it is off. */
    facingStepDegrees: z._default(z.nullable(facingStepDegreesDtoSchema), null),
    /** The Facing rule's arcs, which the tabletop draws around a token; null when the rule is off. */
    facingArcs: z._default(z.nullable(facingArcTableDtoSchema), null),
    version: z.number().check(z.int()).check(z.nonnegative()),
    round: z.number().check(z.int()).check(z.nonnegative()),
    currentActorId: z.nullable(uuidSchema),
    actors: z.array(encounterGmActorDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    reminders: z._default(
      z.array(
        z.strictObject({
          id: uuidSchema,
          label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
          timing: z.enum(['ROUND_START', 'ROUND_END', 'ROUND_NUMBER', 'TURN_START', 'TURN_END']),
          round: z.nullable(z.number().check(z.int()).check(z.positive())),
          actorId: z.nullable(uuidSchema),
          public: z.boolean(),
          notes: z.nullable(z.string().check(z.maxLength(4000))),
          order: z.number().check(z.int()).check(z.nonnegative())
        })
      ),
      []
    ),
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
)

export { encounterRuleOccurrenceSummaryDtoSchema, pendingEncounterRuleOccurrenceSummaryDtoSchema }

const d20RollModeSchema = lazySchema(() => systemCoreCodeSchema)

/**
 * One "Roll dice" attempt for a prompt row, recorded by the server and settled later only by its
 * `rollId` (ADR 0034 decision 3). Advantage and disadvantage keep two faces; `value` is the kept one.
 */
export const encounterEvidenceRollDtoSchema = lazySchema(() =>
  z
    .strictObject({
      rollId: uuidSchema,
      occurrenceId: uuidSchema,
      occurrenceVersion: versionSchema,
      requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
      attempt: z.number().check(z.int()).check(z.positive()),
      faces: z.array(z.number().check(z.int())).check(z.minLength(1)).check(z.maxLength(2)),
      value: z.number().check(z.int()),
      /** The mode the d20 was rolled with; null for any other roll. */
      rollMode: z.nullable(d20RollModeSchema),
      /** Which of `faces` a d20 counts; null exactly when `rollMode` is. */
      keep: z.nullable(rollModeKeepSchema),
      /** The rules-derived mode the row recommended; differs from `rollMode` when overridden. */
      derivedRollMode: z.nullable(d20RollModeSchema),
      /** The faces of the request's added dice (D156), rolled with the d20. */
      addedFaces: z.optional(d20AddedFacesDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        if (
          (value.rollMode === null) !== (value.derivedRollMode === null) ||
          (value.rollMode === null) !== (value.keep === null)
        )
          context.addIssue({
            code: 'custom',
            message: 'Only d20 rolls carry roll modes.'
          })
        if (value.faces.length !== (value.keep ? rollModeKeepFaceCount(value.keep) : 1))
          context.addIssue({
            code: 'custom',
            path: ['faces'],
            message: 'Roll faces are invalid.'
          })
      })
    )
)
export type EncounterEvidenceRollDto = z.infer<typeof encounterEvidenceRollDtoSchema>

/**
 * The recorded faces a `SYSTEM_ROLL` response settles with, read by the server from its roll id.
 * Server-to-planner only; a client never supplies these values.
 */
export const encounterSettledAppRollDtoSchema = lazySchema(() =>
  z.strictObject({
    rollId: uuidSchema,
    faces: z.array(z.number().check(z.int())).check(z.minLength(1)).check(z.maxLength(2)),
    rollMode: z.nullable(d20RollModeSchema),
    keep: z.nullable(rollModeKeepSchema),
    addedFaces: z.optional(d20AddedFacesDtoSchema)
  })
)
export type EncounterSettledAppRollDto = z.infer<typeof encounterSettledAppRollDtoSchema>

export const encounterCommandResultDtoSchema = lazySchema(() =>
  z.strictObject({
    projection: z.union([encounterGmProjectionDtoSchema, encounterPlayerProjectionDtoSchema]),
    roll: z.nullable(rollRecordDtoSchema),
    occurrence: z._default(z.nullable(encounterRuleOccurrenceSummaryDtoSchema), null),
    /** Present only for `ROLL_RULE_EVIDENCE`: the attempt the row now shows. */
    evidenceRoll: z._default(z.nullable(encounterEvidenceRollDtoSchema), null)
  })
)

export const encounterTimelineEntryDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    version: versionSchema,
    commandType: z.string().check(z.minLength(1)).check(z.maxLength(80)),
    /** PRIVATE is the GM's alone; TABLE is every member's; ISSUER is the GM's and the issuing user's. */
    visibility: z.enum(['PRIVATE', 'TABLE', 'ISSUER']),
    actorUserId: uuidSchema,
    createdAt: timestampSchema,
    roll: z.nullable(rollRecordDtoSchema),
    /** The action a RESOLVE_ACTION entry took, or the escape or drop it records; null for every other command. */
    label: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))),
    /** Rule warnings the action overrode; the GM log badges each one. */
    ruleOverrides: encounterRuleWarningsDtoSchema,
    /** History lines for the issuing user, such as an area's outcomes for its caster; empty for every other player. */
    issuerLines: z.array(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))),
    /** GM-only history lines, such as the GM removing a creature from an area; always empty for a player. */
    gmLines: z.array(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)))
  })
)
export const encounterTimelineDtoSchema = lazySchema(() =>
  z.strictObject({
    entries: z.array(encounterTimelineEntryDtoSchema),
    nextCursor: z.nullable(z.string())
  })
)

const encounterEnemySnapshotDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum(['CREATURE', 'CUSTOM']),
    sourceId: z.nullable(postgresUuidSchema),
    sourceRevision: z.nullable(z.number().check(z.int()).check(z.positive())),
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    systemId: z.nullable(postgresUuidSchema),
    maxHitPoints: z.number().check(z.int()).check(z.nonnegative()),
    snapshot: jsonValueSchema
  })
)

export const encounterBlueprintEnemyInputDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CREATURE'),
      sourceId: postgresUuidSchema
    }),
    z.strictObject({
      kind: z.literal('CUSTOM'),
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
      maxHitPoints: z.number().check(z.int()).check(z.nonnegative())
    })
  ])
)

export const encounterBlueprintDtoSchema = lazySchema(() =>
  z.extend(encounterBlueprintMetadataDtoSchema, {
    enemies: z.array(encounterEnemySnapshotDtoSchema)
  })
)
export const encounterBlueprintListDtoSchema = lazySchema(() =>
  z.array(encounterBlueprintDtoSchema)
)
export const createEncounterBlueprintInputDtoSchema = lazySchema(() =>
  z.strictObject({
    gameSystemId: postgresUuidSchema,
    name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    enemies: z
      .array(encounterBlueprintEnemyInputDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    commandId: postgresUuidSchema
  })
)
export const updateEncounterBlueprintInputDtoSchema = lazySchema(() =>
  z.strictObject({
    blueprintId: postgresUuidSchema,
    expectedVersion: z.number().check(z.int()).check(z.positive()),
    name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    enemies: z
      .array(encounterBlueprintEnemyInputDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    commandId: postgresUuidSchema
  })
)

export const getEncounterInputDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: uuidSchema
  })
)
/** Current GM-only side bindings; historical Run projections keep their existing shape. */
export const getEncounterActorSidesInputDtoSchema = lazySchema(() =>
  z.extend(getEncounterInputDtoSchema, {
    expectedVersion: versionSchema
  })
)
export const encounterActorSidesDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: uuidSchema,
    version: versionSchema,
    sides: z
      .array(
        z.strictObject({
          id: uuidSchema,
          label: z.string(),
          sortOrder: z.number().check(z.int()).check(z.nonnegative())
        })
      )
      .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    actors: z
      .array(z.strictObject({ id: uuidSchema, sideId: uuidSchema }))
      .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
  })
)
export type EncounterActorSidesDto = z.infer<typeof encounterActorSidesDtoSchema>

export const getPendingEncounterRuleOccurrenceInputDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: uuidSchema
  })
)
export const getCampaignEncounterInputDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema
  })
)
export const createEncounterInputDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    blueprintId: postgresUuidSchema,
    commandId: uuidSchema
  })
)
export const deletePreparedEncounterInputDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    encounterId: uuidSchema,
    commandId: uuidSchema,
    expectedVersion: z.number().check(z.int()).check(z.nonnegative())
  })
)
export const deletePreparedEncounterResultDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    encounterId: uuidSchema
  })
)
export const getEncounterBlueprintsInputDtoSchema = lazySchema(() =>
  z.strictObject({
    gameSystemId: postgresUuidSchema
  })
)
export const getEncounterTimelineInputDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: uuidSchema,
    cursor: z.optional(z.string().check(z.uuid())),
    limit: z._default(z.number().check(z.int()).check(z.positive()).check(z.lte(100)), 50)
  })
)
export const encounterProjectionDtoSchema = lazySchema(() =>
  z.union([encounterGmProjectionDtoSchema, encounterPlayerProjectionDtoSchema])
)
export const encounterProjectionListDtoSchema = lazySchema(() =>
  z.array(encounterProjectionDtoSchema)
)
/**
 * One Run in a Campaign's Encounter list: what the picker and the player list show, read from the
 * Run alone. The selected Run's projection comes from `projectionReads:get`.
 */
export const encounterSummaryDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
    status: encounterStatusDtoSchema,
    round: z.number().check(z.int()).check(z.nonnegative()),
    /** Null for a player, who sees only the Run's public actors. */
    actorCount: z.nullable(
      z.number().check(z.int()).check(z.nonnegative()).check(z.lte(MAX_ENCOUNTER_ACTORS))
    ),
    updatedAt: timestampSchema,
    version: z.number().check(z.int()).check(z.nonnegative())
  })
)
export const encounterSummaryListDtoSchema = lazySchema(() => z.array(encounterSummaryDtoSchema))
export type EncounterSummaryDto = z.infer<typeof encounterSummaryDtoSchema>
export const encounterSessionStateDtoSchema = lazySchema(() =>
  z.strictObject({
    encounter: z.nullable(encounterProjectionDtoSchema),
    pending: z.nullable(pendingEncounterRuleOccurrenceSummaryDtoSchema),
    /**
     * Who the table waits on when a decision is pending that this member can't answer: the GM, or
     * another player. Null when nothing is pending or the decision is this member's own.
     */
    waitingOn: z.nullable(z.enum(['GM', 'PLAYER'])),
    /**
     * Movement spent this turn, in feet, for each actor the viewer controls (every actor for the GM).
     * `used` is the one total of feet moved this turn, whatever speed type each move named. Each
     * allowance is the feet the actor may move this turn at that speed type, after active grants,
     * conditions and Dash. Switching speed type subtracts the distance already moved (SRD "Using
     * Different Speeds"), so the feet left at a type are its `budget` minus `used`. `speedId` is the
     * speed type of the actor's latest move this turn (null before any move named one). A custom
     * actor has no allowances. Movement is shown, never enforced.
     */
    turnMovement: z
      .array(
        z.strictObject({
          actorId: postgresUuidSchema,
          used: z.number().check(z.nonnegative()),
          speedId: z.nullable(authoredIdentifierSchema),
          allowances: z
            .array(
              z.strictObject({
                speedId: authoredIdentifierSchema,
                /** The System speed vocabulary's code for the type (WALK, FLY, ...), when it has one. */
                code: z.nullable(authoredShortTextSchema),
                /** Whether this is the System's default movement type (its `defaults.movementTypeId`). */
                isDefault: z.boolean(),
                label: authoredShortTextSchema,
                budget: z.number().check(z.nonnegative())
              })
            )
            .check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems)),
          /** The unspent one-shot teleports this turn's casts granted (Misty Step); a TELEPORT move spends one. */
          teleport: z
            .array(teleportAllowanceDtoSchema)
            .check(z.maxLength(MAX_TURN_TELEPORT_ALLOWANCES)),
          /**
           * The creatures this actor must Dash away from this turn, because a held condition
           * authored `fleesSource` (Fear); empty when it flees none. Shown, never enforced.
           */
          fleeSourceActorIds: z.array(postgresUuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
        })
      )
      .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    /**
     * The visible fields in the Run's Scene that a voluntary mover may cross carefully: double the
     * movement cost for no entry save. A dragged path that enters one offers that choice. A hidden
     * field is never listed, nor one concealed from the member (MOVE-3.3).
     */
    halfSpeedFields: z
      .array(
        z.strictObject({
          id: postgresUuidSchema,
          label: z.nullable(
            z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
          ),
          shape: spatialGeometryDtoSchema
        })
      )
      .check(z.maxLength(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)),
    /**
     * The auras the member's map draws: a circle of `radius` around the source token that moves
     * with it. Only an aura whose source the member's projection lists is carried.
     */
    auras: z
      .array(
        z.strictObject({
          id: postgresUuidSchema,
          label: z.nullable(
            z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
          ),
          radius: spatialPositiveDistanceDtoSchema,
          sourceTokenId: postgresUuidSchema
        })
      )
      .check(z.maxLength(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)),
    /**
     * The visible, active zones that raise what moving through them costs (D154, D156), so the map
     * can price a dragged path as the room will. A token-anchored zone is carried only when the
     * member's projection lists its source, and `unaffectedActorIds` names only listed actors.
     * Shown, never enforced: the room charges the movement. A zone concealed from the member is not
     * carried (MOVE-3.3).
     */
    movementCostZones: z
      .array(
        z.strictObject({
          id: postgresUuidSchema,
          multiplier: zoneMovementCostMultiplierSchema,
          anchorKind: z.enum(['FIXED', 'TOKEN']),
          geometry: spatialPersistedGeometryDtoSchema,
          sourceTokenId: z.nullable(postgresUuidSchema),
          unaffectedActorIds: z.array(postgresUuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
        })
      )
      .check(z.maxLength(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)),
    /**
     * The visible zones fixed to the Run's Scene, whose outlines the member's map draws. A zone
     * concealed from the member is not listed: the GM sees every zone, a player only those one of
     * their Characters knows of (MOVE-3.3). The spot and disarm DCs reach only the GM; a player reads
     * null. `unawareActorIds` are the Run's actors that have not noticed a concealed zone, so they get
     * no "Move carefully" offer and the GM's route lists them (MOVE-3.6); a player reads only their
     * own, and every list is empty for a zone in plain sight.
     */
    placedZones: z
      .array(
        z.strictObject({
          id: postgresUuidSchema,
          label: z.nullable(
            z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
          ),
          shape: spatialGeometryDtoSchema,
          spotDc: z.nullable(zoneDcDtoSchema),
          disarmDc: z.nullable(zoneDcDtoSchema),
          unawareActorIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
        })
      )
      .check(z.maxLength(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE)),
    /**
     * The concealed zones a Character has been sighted near whose passive Perception met the spot
     * DC and that the GM has not yet revealed or dismissed (MOVE-3.5). Only the GM reads it; a
     * player's list is always empty.
     */
    pendingZoneSightings: z
      .array(z.strictObject({ spatialEffectId: postgresUuidSchema, actorId: uuidSchema }))
      .check(z.maxLength(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE * MAX_ENCOUNTER_ACTORS))
  })
)
export type EncounterSessionStateDto = z.infer<typeof encounterSessionStateDtoSchema>
/**
 * The PREPARED Runs paused on a START decision this member sees (initiative or recharge), each
 * with the decision itself: a PREPARED Run never shares the Campaign with an ACTIVE one.
 */
export const encounterPreparedPendingListDtoSchema = lazySchema(() =>
  z.array(
    z.strictObject({
      encounter: encounterProjectionDtoSchema,
      pending: pendingEncounterRuleOccurrenceSummaryDtoSchema
    })
  )
)
export type EncounterPreparedPendingListDto = z.infer<typeof encounterPreparedPendingListDtoSchema>
export const getEncounterDecisionSettlementInputDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: uuidSchema,
    occurrenceId: uuidSchema,
    occurrenceVersion: versionSchema
  })
)
export type GetEncounterDecisionSettlementInputDto = z.infer<
  typeof getEncounterDecisionSettlementInputDtoSchema
>
/** Who settled a decision the viewer was shown (D39); null while it is still pending. */
export const encounterDecisionSettlementDtoSchema = lazySchema(() =>
  z.nullable(z.enum(['ANSWER', 'GM_SKIP']))
)
export type EncounterDecisionSettlementDto = z.infer<typeof encounterDecisionSettlementDtoSchema>
/** A settled decision the room pushes with the session state, keyed as the viewer saw it. */
export const encounterSettledDecisionDtoSchema = lazySchema(() =>
  z.strictObject({
    occurrenceId: uuidSchema,
    occurrenceVersion: versionSchema,
    outcome: z.enum(['ANSWER', 'GM_SKIP'])
  })
)

export type EncounterPlayerProjectionDto = z.infer<typeof encounterPlayerProjectionDtoSchema>
export type EncounterGmProjectionDto = z.infer<typeof encounterGmProjectionDtoSchema>
export type EncounterGmActorDto = z.infer<typeof encounterGmActorDtoSchema>
export type EncounterCommandResultDto = z.infer<typeof encounterCommandResultDtoSchema>
export type { EncounterRuleOccurrenceSummaryDto, PendingEncounterRuleOccurrenceSummaryDto }
export type EncounterTimelineDto = z.infer<typeof encounterTimelineDtoSchema>
export type CreateEncounterInputDto = z.infer<typeof createEncounterInputDtoSchema>
export type DeletePreparedEncounterInputDto = z.infer<typeof deletePreparedEncounterInputDtoSchema>
export type DeletePreparedEncounterResultDto = z.infer<
  typeof deletePreparedEncounterResultDtoSchema
>
export type EncounterBlueprintDto = z.infer<typeof encounterBlueprintDtoSchema>
export type CreateEncounterBlueprintInputDto = z.infer<
  typeof createEncounterBlueprintInputDtoSchema
>
export type UpdateEncounterBlueprintInputDto = z.infer<
  typeof updateEncounterBlueprintInputDtoSchema
>
