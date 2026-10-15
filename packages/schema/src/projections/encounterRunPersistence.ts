import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { MAX_ENCOUNTER_ACTORS, authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { projectionChecksumSchema } from './identity.js'
import { encounterCreatureEquipmentReplacementSchema } from './encounterCreatureEquipment.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import {} from '../shared/basicActions.js'
import { encounterActionEconomyTransitionDtoSchema } from '../shared/ruleExecutionEncounterApplications.js'
import { encounterRuleOccurrenceSummaryDtoSchema } from '../shared/encounterRuleOccurrence.js'
import { rollRecordDtoSchema } from '../api/rolls.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from '../shared/activeRuleEffects.js'
import { activeRuleEffectRecordSchema } from './activeRuleEffectPersistence.js'

// Keep the Convex table schema independent of recursive authored snapshots. Projections are built
// on read from the Run state and its actors (ADR 0035 Amendment 12), so the Run stores neither.
export const encounterStoredRunSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    campaignId: postgresUuidSchema,
    gameSystemId: postgresUuidSchema,
    status: z.enum(['PREPARED', 'ACTIVE', 'COMPLETED']),
    version: z.number().check(z.int()).check(z.nonnegative()),
    stateJson: z.string(),
    stateChecksum: projectionChecksumSchema,
    /** The create command that made the Run: a retry finds it here after the history is gone. */
    createCommandId: postgresUuidSchema,
    createCommandFingerprint: projectionChecksumSchema,
    /**
     * D99, SPELLS-5.7: the Characters that committed a Concentration start in this Run, appended by
     * the room and never removed. Each new id lets the completing checkpoint end the carried grants
     * that Character cast on Characters outside the Run, even when the Concentration later ended.
     */
    concentrationCasterCharacterIds: z
      .array(postgresUuidSchema)
      .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
)

/**
 * What a settled command returned besides its projection: the roll and the occurrence summary.
 * Exact replay rebuilds the projection from the Run's records and adds these; the timeline shows
 * the roll.
 */
export const encounterStoredReplayReceiptSchema = lazySchema(() =>
  z.strictObject({
    roll: z.nullable(rollRecordDtoSchema),
    occurrence: z.nullable(encounterRuleOccurrenceSummaryDtoSchema)
  })
)
export type EncounterStoredReplayReceipt = z.infer<typeof encounterStoredReplayReceiptSchema>

/**
 * The stored input of a Run command the room writes when a caster outside the Run drops a
 * Concentration the Run's Characters carry grants of (SPELLS-5.11). Never sent by a client, so it
 * stays outside the Encounter command union.
 */
export const encounterConcentrationDroppedOutsideInputSchema = lazySchema(() =>
  z.strictObject({
    type: z.literal('CONCENTRATION_DROPPED_OUTSIDE'),
    commandId: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    casterCharacterId: postgresUuidSchema
  })
)

/**
 * One actor's stored state (`encounterStoredRunActorStateSchema` JSON) with the checksum of its
 * play state: the actor without its source snapshot and without the facts derived from it (ADR 0035
 * Amendment 29). `snapshotChecksum` and `sourceFactsChecksum` repeat the stored state's references
 * so the Run can find the shared rows no actor names any more.
 */
export const encounterStoredRunActorSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    stateJson: z.string(),
    stateChecksum: projectionChecksumSchema,
    snapshotChecksum: projectionChecksumSchema,
    sourceFactsChecksum: z.nullable(projectionChecksumSchema)
  })
)

/**
 * One actor source snapshot (`EncounterRunActorState.snapshot` JSON), shared by the Run's actors
 * whose stored state names its checksum. Rows are immutable: a command that changes an actor's
 * snapshot writes a new row and repoints the actor. Deleted with its last actor.
 */
export const encounterStoredActorSnapshotSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    checksum: projectionChecksumSchema,
    snapshotJson: z.string()
  })
)

/**
 * One Creature source's projected stat block and Features (`encounterSourceProjectionFactsSchema`
 * JSON), shared by the Run's actors whose stored state names its checksum. Deleted with its last actor.
 */
export const encounterStoredSourceProjectionFactsSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    checksum: projectionChecksumSchema,
    factsJson: z.string()
  })
)

/**
 * One app roll for a pending evidence request ("Roll dice"). Rows are immutable: a settle by
 * `rollId` reads these faces, and every attempt stays for the roll log and audit.
 */
export const encounterStoredEvidenceRollSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    campaignId: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    occurrenceId: postgresUuidSchema,
    occurrenceVersion: z.number().check(z.int()).check(z.nonnegative()),
    requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
    userId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    commandFingerprint: projectionChecksumSchema,
    attempt: z.number().check(z.int()).check(z.positive()),
    faces: z.array(z.number().check(z.int())).check(z.minLength(1)).check(z.maxLength(2)),
    value: z.number().check(z.int()),
    rollMode: z.nullable(z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])),
    derivedRollMode: z.nullable(z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])),
    createdAt: z.iso.datetime()
  })
)
export type EncounterStoredEvidenceRoll = z.infer<typeof encounterStoredEvidenceRollSchema>

/**
 * The voluntary movement an actor spent during one turn, in feet (D38). The turn is the Run's round
 * and current actor, so a new turn reads a new key and starts at zero. It sits outside the Run's
 * version and checksum: the budget is displayed, never enforced, so no fence reads it.
 * `speedBonuses` counts the basic actions this turn that each added the actor's speed to its
 * budget (Dash, D38). `speedId` is the speed type the actor's latest move this turn named
 * (SPELLS-5.6); null until a move names one.
 */
export const encounterStoredTurnMovementSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    round: z.number().check(z.int()).check(z.positive()),
    turnActorId: postgresUuidSchema,
    actorId: postgresUuidSchema,
    usedFeet: z.number().check(z.nonnegative()),
    speedId: z.nullable(authoredIdentifierSchema),
    speedBonuses: z.number().check(z.int()).check(z.nonnegative())
  })
)

/** A movement decision the GM skipped (D26, D39), so its player's drawer can say so. */
export const encounterStoredDecisionSkipSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    occurrenceId: postgresUuidSchema,
    occurrenceVersion: z.number().check(z.int()).check(z.nonnegative()),
    voidCommandId: postgresUuidSchema
  })
)

export const encounterSceneBindingSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    campaignId: postgresUuidSchema,
    sceneId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    commandFingerprint: projectionChecksumSchema,
    createdAt: z.iso.datetime()
  })
)
export const encounterActorTokenBindingSchema = lazySchema(() =>
  z.strictObject({
    actorId: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    sceneId: postgresUuidSchema,
    tokenId: postgresUuidSchema
  })
)

/**
 * One row per Encounter command the room committed in a Run. It outlives the room's own history
 * (ADR 0035 Amendment 22) so a retry after storage recovery is recognized: the command was applied
 * at `version`, and its roll card (if any) is the persisted chat entry.
 */
export const encounterStoredReplayIndexSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    actorUserId: postgresUuidSchema,
    commandFingerprint: projectionChecksumSchema,
    version: z.number().check(z.int()).check(z.nonnegative()),
    rollCardId: z.nullable(postgresUuidSchema)
  })
)

const encounterStoredRunCommandBaseSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    commandFingerprint: projectionChecksumSchema,
    actorUserId: postgresUuidSchema,
    createdAt: z.iso.datetime(),
    // Optional until the Encounter timeline metadata backfill has completed.
    visibility: z.optional(z.enum(['PRIVATE', 'TABLE', 'ISSUER']))
  })
)

const encounterStoredRunCommandResultSchema = lazySchema(() =>
  z.extend(encounterStoredRunCommandBaseSchema, {
    id: postgresUuidSchema,
    version: z.number().check(z.int()).check(z.positive()),
    commandJson: z.string(),
    /** An `encounterStoredReplayReceiptSchema` document. */
    replayReceiptJson: z.string(),
    replayReceiptChecksum: projectionChecksumSchema
  })
)

export const encounterStoredRunCommandSchema = lazySchema(() =>
  z.discriminatedUnion('commandType', [
    z.extend(encounterStoredRunCommandBaseSchema, {
      commandType: z.literal('CREATE'),
      id: z.optional(postgresUuidSchema),
      version: z.optional(z.literal(0))
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.enum([
        'UPSERT_REMINDER',
        'REMOVE_REMINDER',
        'UPDATE_ACTOR',
        'SET_INITIATIVE',
        'ROLL_ACTOR_INITIATIVE',
        'ROLL_ENEMY_ACTION',
        'ADJUST_FEATURE_RESOURCE',
        'REPLACE_OPTIONAL_COMBAT_RULES',
        'SET_HEALTH_DISPLAY_DEFAULT',
        'COMPLETE',
        'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
      ])
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.enum(['START', 'ADVANCE_TURN', 'MOVE_SCENE_TOKEN', 'RESOLVE_RULE_OCCURRENCE']),
      ruleOccurrenceId: postgresUuidSchema,
      ruleResultChecksum: projectionChecksumSchema,
      optionalCombatSnapshotChecksum: projectionChecksumSchema
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('RESOLVE_ACTION'),
      /** What the action is rooted in: one rule occurrence and its result, or (CHECK, no mechanics batch yet) its own check. */
      root: z.discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('RULE_OCCURRENCE'),
          ruleOccurrenceId: postgresUuidSchema,
          ruleResultChecksum: projectionChecksumSchema,
          optionalCombatSnapshotChecksum: projectionChecksumSchema
        }),
        z.strictObject({
          kind: z.literal('CHECK'),
          /** What the CHECK action spent, so the GM's undo can reverse it exactly. */
          checkReceipt: z.strictObject({
            actorId: postgresUuidSchema,
            actionEconomy: z.nullable(encounterActionEconomyTransitionDtoSchema),
            /** The action's d20 check occurrence, pending or settled; null when an overridden warning ended it before the roll. */
            checkOccurrenceId: z.nullable(postgresUuidSchema)
          })
        })
      ]),
      /** The resolved action's display name, from the prepared action; the timeline shows it. */
      label: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))),
      /** Warnings the submitter overrode ("Do it anyway"); the GM timeline badges each one. */
      ruleOverrides: encounterRuleWarningsDtoSchema,
      /** The grants (Vicious Mockery, Help) this action's rolls used up; its undo gives them back. */
      consumedGrants: z
        .array(activeRuleEffectRecordSchema)
        .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
      /** The Character this action newly added to the Run's `concentrationCasterCharacterIds`; its undo removes it. */
      addedConcentrationCasterId: z.nullable(postgresUuidSchema),
      /** The turn movement record a Dash's speed bonus was added to; its undo removes it. */
      speedBonusTurn: z.nullable(
        z.strictObject({
          round: z.number().check(z.int()).check(z.positive()),
          turnActorId: postgresUuidSchema
        })
      ),
      /** History lines for the user who issued the command, such as an area's outcomes for its caster; the GM sees them too. */
      issuerLines: z._default(
        z
          .array(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)))
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        []
      ),
      /** GM-only history lines (the GM removing a creature from an area); the timeline never shows them to a player. */
      gmLines: z._default(
        z
          .array(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)))
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        []
      )
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('ESCAPE_RELATIONSHIP'),
      /** The timeline label: plain "Escape", which never names a grappler a player cannot see (D100). */
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
      ruleOverrides: encounterRuleWarningsDtoSchema,
      /** What the escape spent, so the GM's undo of a failed attempt returns it. */
      receipt: z.strictObject({
        actorId: postgresUuidSchema,
        actionEconomy: z.nullable(encounterActionEconomyTransitionDtoSchema),
        /** The holder's one-check grants (Help) the check used up; undo gives them back. */
        consumedGrants: z
          .array(activeRuleEffectRecordSchema)
          .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
        /** The escape's d20 check occurrence, pending or settled. */
        checkOccurrenceId: postgresUuidSchema
      })
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('SET_CONCEALMENT_OBSERVERS'),
      /** The observers the GM changed, so the GM's undo restores them while the effect is as this left it. */
      receipt: z.strictObject({
        activeEffectId: postgresUuidSchema,
        holderActorId: postgresUuidSchema,
        beforeObserverActorIds: z
          .array(postgresUuidSchema)
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        afterObserverActorIds: z.array(postgresUuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        afterVersion: z.number().check(z.int()).check(z.positive())
      })
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('CONCENTRATION_DROPPED_OUTSIDE'),
      /** The GM-only notice: "<caster> dropped Concentration: <label> ends on <holders>". */
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('VOID_RULE_OCCURRENCE'),
      ruleOccurrenceId: postgresUuidSchema
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('REVERT_LAST_ACTION'),
      /** The undone RESOLVE_ACTION command, and the action's occurrence if any. */
      revertedCommandId: postgresUuidSchema,
      ruleOccurrenceId: z.nullable(postgresUuidSchema)
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('REMOVE_ACTOR'),
      ruleOccurrenceId: z.nullable(postgresUuidSchema),
      ruleResultChecksum: z.nullable(projectionChecksumSchema),
      initiativeStateJson: z.nullable(z.string()),
      initiativeStateChecksum: z.nullable(projectionChecksumSchema)
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('REORDER'),
      initiativeStateJson: z.nullable(z.string()),
      initiativeStateChecksum: z.nullable(projectionChecksumSchema)
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('REINFORCE'),
      reinforcedActorId: postgresUuidSchema,
      reinforcedActorStateJson: z.string(),
      reinforcedActorStateChecksum: projectionChecksumSchema,
      initiativeStateJson: z.nullable(z.string()),
      initiativeStateChecksum: z.nullable(projectionChecksumSchema)
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('REPLACE_CREATURE_EQUIPMENT'),
      creatureEquipmentReplacement: encounterCreatureEquipmentReplacementSchema
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.enum(['PREVIOUS_TURN', 'SET_CURRENT_ACTOR', 'SET_ROUND']),
      initiativeStateJson: z.string(),
      initiativeStateChecksum: projectionChecksumSchema
    })
  ])
)

export const encounterStoredRuleOccurrenceSchema = lazySchema(() =>
  z
    .strictObject({
      id: postgresUuidSchema,
      campaignId: postgresUuidSchema,
      encounterId: postgresUuidSchema,
      rootCommandId: postgresUuidSchema,
      state: z.enum(['PENDING', 'COMPLETED', 'VOIDED']),
      version: z.number().check(z.int()).check(z.nonnegative()),
      expectedEncounterVersion: z.number().check(z.int()).check(z.nonnegative()),
      /** The pending snapshot's checksum; its content is in `encounterPendingSnapshotParts`. */
      pendingSnapshotChecksum: z.nullable(projectionChecksumSchema),
      completedAt: z.nullable(z.iso.datetime()),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime()
    })
    .check(
      z.superRefine((occurrence, context) => {
        if (
          occurrence.state !== 'PENDING'
            ? occurrence.pendingSnapshotChecksum !== null || occurrence.completedAt === null
            : occurrence.pendingSnapshotChecksum === null || occurrence.completedAt !== null
        )
          context.addIssue({ code: 'custom', message: 'Rule occurrence state is inconsistent.' })
      })
    )
)

/**
 * One part of a pending occurrence's sealed snapshot: sequence 0 holds `{base}`, each later part a
 * `{delta}` from the snapshot before it (`jsonDelta.ts` in `encounter-persistence`).
 */
export const encounterStoredPendingSnapshotPartSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    occurrenceId: postgresUuidSchema,
    sequence: z.number().check(z.int()).check(z.nonnegative()),
    partJson: z.string()
  })
)

export const encounterStoredRuleReceiptSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    campaignId: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    occurrenceId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    commandType: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
    commandFingerprint: projectionChecksumSchema,
    encounterVersion: z.number().check(z.int()).check(z.nonnegative()),
    commandMetadataJson: z.string(),
    resultJson: z.string(),
    resultChecksum: projectionChecksumSchema,
    actorUserId: postgresUuidSchema,
    correlationId: z.nullable(postgresUuidSchema),
    createdAt: z.iso.datetime()
  })
)
