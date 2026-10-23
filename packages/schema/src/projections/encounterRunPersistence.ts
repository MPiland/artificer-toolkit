import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { spatialPointDtoSchema } from '../shared/spatialFacts.js'
import { d20AddedFacesDtoSchema } from '../shared/d20AddedDice.js'
import {
  MAX_TURN_TELEPORT_ALLOWANCES,
  teleportAllowanceDtoSchema
} from '../shared/teleportAllowance.js'
import { MAX_ENCOUNTER_ACTORS, authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { projectionChecksumSchema } from './identity.js'
import { encounterCreatureEquipmentReplacementSchema } from './encounterCreatureEquipment.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import {} from '../shared/basicActions.js'
import { encounterActionEconomyTransitionDtoSchema } from '../shared/ruleExecutionEncounterApplications.js'
import { encounterFailedCounterReceiptDtoSchema } from '../shared/ruleExecutionReactionChoice.js'
import { encounterRuleOccurrenceSummaryDtoSchema } from '../shared/encounterRuleOccurrence.js'
import { rollRecordDtoSchema } from '../api/rolls.js'
import {
  characterMechanicsTargetStateDtoSchema,
  encounterFeatureResourceReceiptDtoSchema
} from '../shared/ruleExecutionMechanics.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from '../shared/activeRuleEffects.js'
import {
  activeRuleEffectRecordSchema,
  encounterMaintainedEffectStateRecordSchema
} from './activeRuleEffectPersistence.js'
import { rollModeKeepSchema, systemCoreCodeSchema } from '../shared/systemCoreCode.js'

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

/** The relationships a command ended (D152): each held creature, its effect and the conditions only it held. */
export const encounterRelationshipEndsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        heldActorId: postgresUuidSchema,
        activeEffectId: postgresUuidSchema,
        removedConditionIds: z
          .array(postgresUuidSchema)
          .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
      })
    )
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS * MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
)
export type EncounterRelationshipEnds = z.infer<typeof encounterRelationshipEndsSchema>

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
 * The stored input of a Run command the room writes when a command returned an actor to play onto a
 * space another token holds (D184). Never sent by a client, so it stays outside the Encounter
 * command union.
 */
export const encounterReturnedToPlayInputSchema = lazySchema(() =>
  z.strictObject({
    type: z.literal('RETURNED_TO_PLAY'),
    commandId: postgresUuidSchema,
    encounterId: postgresUuidSchema
  })
)

/**
 * The stored input of a Run command the room writes when relationships end on their own (D152): a
 * source that can't act, or a held creature moved beyond the sealed reach. Never sent by a client,
 * so it stays outside the Encounter command union.
 */
export const encounterRelationshipsEndedInputSchema = lazySchema(() =>
  z.strictObject({
    type: z.literal('RELATIONSHIPS_ENDED'),
    commandId: postgresUuidSchema,
    encounterId: postgresUuidSchema
  })
)

/**
 * One actor's stored state (`encounterStoredRunActorStateSchema` JSON) with the checksum of its
 * play state: the actor without its source snapshot and without the facts derived from it (ADR 0035
 * Amendment 29). `snapshotChecksum`, `formOriginSnapshotChecksum` and `sourceFactsChecksum` repeat
 * the stored state's references so the Run can find the shared rows no actor names any more.
 */
export const encounterStoredRunActorSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    stateJson: z.string(),
    stateChecksum: projectionChecksumSchema,
    snapshotChecksum: projectionChecksumSchema,
    /** The snapshot of the creature the actor was before its form (D130), or null. */
    formOriginSnapshotChecksum: z.nullable(projectionChecksumSchema),
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
 * One Spell a Run's Creatures name, pinned once per Run by `spellId`: the stored compilation
 * (`authoredStoredCompilationSchema` JSON) of the version read when the Run first needed it, as
 * D163's Equipment pins hold theirs. Actors reference it by the Spell IDs in their Creature grants.
 */
export const encounterStoredSpellPinSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    spellId: postgresUuidSchema,
    sourceRevision: z.number().check(z.int()).check(z.positive()),
    sourceVersionId: postgresUuidSchema,
    sourceChecksum: projectionChecksumSchema,
    compilationJson: z.string()
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
    rollMode: z.nullable(systemCoreCodeSchema),
    keep: z.nullable(rollModeKeepSchema),
    derivedRollMode: z.nullable(systemCoreCodeSchema),
    /** The faces of the request's added dice (D156), rolled with the d20. */
    addedFaces: z.optional(d20AddedFacesDtoSchema),
    createdAt: z.iso.datetime()
  })
)
export type EncounterStoredEvidenceRoll = z.infer<typeof encounterStoredEvidenceRollSchema>

/** The usage keys of once-per-turn damage an attack spent: the id of the Feature or Effect that grants it. */
export const encounterTurnUseKeysSchema = lazySchema(() =>
  z.array(authoredIdentifierSchema).check(z.maxLength(16))
)

export const encounterTeleportAllowanceSchema = lazySchema(() =>
  z.strictObject({
    ...teleportAllowanceDtoSchema.shape,
    consumedByCommandId: z.nullable(postgresUuidSchema)
  })
)
export type EncounterTeleportAllowance = z.infer<typeof encounterTeleportAllowanceSchema>

/** The token positions an actor's latest voluntary move this turn began and ended at (D164). */
export const encounterTurnLastMoveSchema = lazySchema(() =>
  z.strictObject({ start: spatialPointDtoSchema, end: spatialPointDtoSchema })
)
export type EncounterTurnLastMove = z.infer<typeof encounterTurnLastMoveSchema>

/**
 * What an actor did during one turn (D38, D119). The turn is the Run's round and current actor, so
 * a new turn reads a new key and starts empty. It sits outside the Run's version and checksum.
 * `usedFeet` is the voluntary movement spent, in feet; the budget is displayed, never enforced, so
 * no fence reads it. `speedBonuses` counts the basic actions this turn that each added the actor's
 * speed to its budget (Dash, D38). `speedId` is the speed type the actor's latest move this turn
 * named (SPELLS-5.6); null until a move names one. `usedOncePerTurn` lists the usage keys of the
 * once-per-turn damage the actor has dealt this turn (Sneak Attack, D119); unlike the movement it
 * is enforced, so the commit transaction reads and writes it. `teleportAllowances` lists the
 * one-shot teleports the actor's casts granted this turn (Misty Step, Dimension Door; SPELLS-28.2):
 * each names its cast, its range in feet and whether the destination must be seen, and the move
 * that spent it, if any. A player's TELEPORT move is refused without an unspent entry.
 * `lastMove` is where the actor's latest voluntary move this turn began and ended (D164), which
 * the Charge gate reads; each voluntary move replaces it, and forced movement or a teleport this
 * turn clears it. Like the movement, it is never enforced. `startedByCommandId` is the START or
 * ADVANCE_TURN command that began this turn and ran its start-of-turn effects; a turn that returns
 * (Previous Turn, then Next) finds it set, so those effects never run twice (SPELLS-33.T4i1c).
 */
export const encounterStoredTurnMovementSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    round: z.number().check(z.int()).check(z.positive()),
    turnActorId: postgresUuidSchema,
    actorId: postgresUuidSchema,
    usedFeet: z.number().check(z.nonnegative()),
    speedId: z.nullable(authoredIdentifierSchema),
    speedBonuses: z.number().check(z.int()).check(z.nonnegative()),
    lastMove: z._default(z.nullable(encounterTurnLastMoveSchema), null),
    usedOncePerTurn: z._default(encounterTurnUseKeysSchema, []),
    startedByCommandId: z._default(z.nullable(postgresUuidSchema), null),
    teleportAllowances: z._default(
      z.array(encounterTeleportAllowanceSchema).check(z.maxLength(MAX_TURN_TELEPORT_ALLOWANCES)),
      []
    )
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

/** What ended a forced movement short of, or at, its distance: nothing, an object or wall, or a creature. */
export const encounterForcedMovementLandingSchema = lazySchema(() =>
  z.strictObject({
    targetActorId: postgresUuidSchema,
    feet: z.number().check(z.nonnegative()),
    stoppedBy: z.union([z.literal('NONE'), z.literal('OBJECT'), postgresUuidSchema]),
    ray: z.nullable(spatialPointDtoSchema),
    /** D170: the hit points the zone contacts along the path changed, so a GM revert restores them with the move. */
    zoneDamage: z.optional(
      z
        .array(
          z.strictObject({
            targetActorId: postgresUuidSchema,
            before: characterMechanicsTargetStateDtoSchema,
            after: characterMechanicsTargetStateDtoSchema
          })
        )
        .check(z.maxLength(32))
    ),
    /** D170: set when the zone contacts did more than change hit points, which a revert cannot restore. */
    zoneUndoRefused: z.optional(z.literal(true))
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
          optionalCombatSnapshotChecksum: projectionChecksumSchema,
          /** A spell cast's own ability-check occurrence (D182); its answers settle under this root. */
          checkOccurrenceId: z.optional(postgresUuidSchema)
        }),
        z.strictObject({
          kind: z.literal('CHECK'),
          /** What the CHECK action spent, so the GM's undo can reverse it exactly. */
          checkReceipt: z.strictObject({
            actorId: postgresUuidSchema,
            actionEconomy: z.nullable(encounterActionEconomyTransitionDtoSchema),
            /** The charges a Creature feature's check spent (D173); null for a basic action or none. */
            featureResourceConsumption: z.nullable(encounterFeatureResourceReceiptDtoSchema),
            /** The action's d20 check occurrence, pending or settled; null when an overridden warning ended it before the roll. */
            checkOccurrenceId: z.nullable(postgresUuidSchema)
          })
        })
      ]),
      /** The resolved action's display name, from the prepared action; the timeline shows it. */
      label: z.nullable(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))),
      /** Warnings the submitter overrode ("Do it anyway"); the GM timeline badges each one. */
      ruleOverrides: encounterRuleWarningsDtoSchema,
      /** The grants (Vicious Mockery, Help) this action's rolls used up and the grants its incapacitations ended; its undo gives them back. */
      consumedGrants: z
        .array(activeRuleEffectRecordSchema)
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS * MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
      /** The maintained states the grants it ended left with no dependent, exactly as they were; its undo gives them back before the grants. */
      endedMaintainedStates: z
        .array(encounterMaintainedEffectStateRecordSchema)
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS * MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
      /** The Character this action newly added to the Run's `concentrationCasterCharacterIds`; its undo removes it. */
      addedConcentrationCasterId: z.nullable(postgresUuidSchema),
      /** The damage record a start-of-turn trigger emptied, with its holder; its undo puts the entries back. */
      clearedDamageTypes: z._default(
        z.nullable(
          z.strictObject({
            actorId: postgresUuidSchema,
            entries: z
              .array(
                z.strictObject({ damageTypeId: postgresUuidSchema, commandId: postgresUuidSchema })
              )
              .check(z.maxLength(256))
          })
        ),
        null
      ),
      /** True once a held damage mirror passed this action's damage on to its source; undo can't restore that source. */
      damageMirrored: z._default(z.boolean(), false),
      /** The turn movement record a Dash's speed bonus was added to; its undo removes it. */
      speedBonusTurn: z.nullable(
        z.strictObject({
          round: z.number().check(z.int()).check(z.positive()),
          turnActorId: postgresUuidSchema
        })
      ),
      /** The turn movement record a teleport spell's allowance was added to; its undo removes it, and is refused once a move spent it. */
      teleportAllowanceTurn: z._default(
        z.nullable(
          z.strictObject({
            round: z.number().check(z.int()).check(z.positive()),
            turnActorId: postgresUuidSchema
          })
        ),
        null
      ),
      /**
       * The Scene token moves this action's forced movement committed, farthest-first. The Scene
       * command records hold the positions; its undo reverts each, last first, and is refused once
       * a pushed token moved again (ATTACK-7.T5a, D139).
       */
      forcedMovements: z._default(
        z
          .array(
            z.strictObject({ sceneId: postgresUuidSchema, sceneCommandId: postgresUuidSchema })
          )
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        []
      ),
      /**
       * The Scene tokens this action conjured, each with the Scene command that created it and the
       * actor it is bound to. Its undo removes them; a replay finds them here.
       */
      summonedTokens: z._default(
        z
          .array(
            z.strictObject({
              sceneId: postgresUuidSchema,
              sceneCommandId: postgresUuidSchema,
              tokenId: postgresUuidSchema,
              actorId: postgresUuidSchema
            })
          )
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        []
      ),
      /**
       * Where each creature the action moved ended up: the feet it travelled, what stopped it short
       * of its distance, and the random direction rolled for it.
       */
      forcedMovementLandings: z._default(
        z.array(encounterForcedMovementLandingSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        []
      ),
      /** The once-per-turn uses this action spent from the actor's turn record; its undo gives them back. */
      turnUses: z._default(
        z.nullable(
          z.strictObject({
            round: z.number().check(z.int()).check(z.positive()),
            turnActorId: postgresUuidSchema,
            keys: encounterTurnUseKeysSchema
          })
        ),
        null
      ),
      /** The counters reactors failed against this cast and the reactor spend each cost; its undo gives them back (D127). */
      failedCounters: z._default(
        z.array(encounterFailedCounterReceiptDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        []
      ),
      /** Each actor this action armed or engaged for an idle-bound grant, with the mark it held before; its undo restores them. */
      idleTurnMarkChanges: z._default(
        z
          .array(
            z.strictObject({
              actorId: postgresUuidSchema,
              before: z.nullable(z.enum(['ARMED', 'ENGAGED']))
            })
          )
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        []
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
      commandType: z.literal('ESCAPE'),
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
        afterVersion: z.number().check(z.int()).check(z.positive()),
        /** The concealment as it was when this change left it no observers and ended it; undo gives it back. */
        endedEffect: z.nullable(activeRuleEffectRecordSchema)
      })
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('CREATURE_REST'),
      /** The feature charges and spell slot rows each creature got back, so the GM's undo spends them again. */
      receipt: z.strictObject({
        restKind: z.enum(['SHORT', 'LONG']),
        actors: z
          .array(
            z.strictObject({
              actorId: postgresUuidSchema,
              resets: z.array(
                z.strictObject({
                  key: z.string().check(z.trim()).check(z.minLength(1)),
                  beforeUsed: z.number().check(z.int()).check(z.positive())
                })
              )
            })
          )
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      })
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('END_HELD_GRANT'),
      /** The timeline label: plain "End effect", which never names a source a player cannot see. */
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
      ruleOverrides: encounterRuleWarningsDtoSchema,
      /** What ending the grant spent. The ended grant itself is not restored by an undo (D99). */
      receipt: z.strictObject({
        actorId: postgresUuidSchema,
        actionEconomy: z.nullable(encounterActionEconomyTransitionDtoSchema)
      })
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('MOVE_HELD_EFFECT'),
      /** The timeline label: plain "Move effect", which never names a source a player cannot see. */
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
      ruleOverrides: encounterRuleWarningsDtoSchema,
      /** What the move spent and the effect it moved, so the GM's undo can put it back (D160). */
      receipt: z.strictObject({
        actorId: postgresUuidSchema,
        actionEconomy: z.nullable(encounterActionEconomyTransitionDtoSchema),
        effectId: postgresUuidSchema,
        fromActorId: postgresUuidSchema,
        toActorId: postgresUuidSchema,
        /** The effect as the old holder kept it; undo recreates exactly this record there. */
        before: activeRuleEffectRecordSchema,
        /** The version the effect had at the new holder, so undo refuses once it has changed. */
        afterVersion: z.number().check(z.int()).check(z.positive())
      })
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('RELEASE_RELATIONSHIP'),
      /** The timeline label: plain "Release", which never names a held creature a player cannot see. */
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
      /** The hold the source let go of. The ended relationship is not restored by an undo. */
      receipt: z.strictObject({
        actorId: postgresUuidSchema,
        relationshipEnds: encounterRelationshipEndsSchema
      })
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('RELATIONSHIPS_ENDED'),
      /** The timeline label: plain "Hold ended", which never names a creature a player cannot see. */
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
      /** The holds that broke. An ended relationship is not restored by an undo. */
      receipt: z.strictObject({ relationshipEnds: encounterRelationshipEndsSchema })
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('CONCENTRATION_DROPPED_OUTSIDE'),
      /** The GM-only notice: "<caster> dropped Concentration: <label> ends on <holders>". */
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
    }),
    z.extend(encounterStoredRunCommandResultSchema, {
      commandType: z.literal('RETURNED_TO_PLAY'),
      /** The GM-only notice: "<actors> returned to play onto an occupied space: place them by hand". */
      label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
      /** `RETURN_SPACE_OCCUPIED`: the GM timeline badges it. No Scene token is moved (D184). */
      ruleOverrides: encounterRuleWarningsDtoSchema
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
