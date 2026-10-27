import { z, lazySchema } from '../zod.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { rollVisibilityDtoSchema } from './rolls.js'
import { movementReactionChoiceSelectionDtoSchema } from '../shared/reaction.js'
import { serverRuleExecutionCorrelationIdDtoSchema } from '../shared/ruleExecutionProtocol.js'
import { spatialPointDtoSchema, type SpatialPointDto } from '../shared/spatialFacts.js'
import { encounterAcknowledgedRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import { d20AddedFacesDtoSchema } from '../shared/d20AddedDice.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'
import { moraleDispositionDtoSchema, moraleTriggerKindDtoSchema } from '../shared/optionalCombat.js'
import { manifestDtoSchema } from '../effects/manifest.js'
import { zoneDcDtoSchema } from '../shared/spatial.js'
import { sceneTokenFacingCommandInputDtoSchema } from './vttScenes.js'

const uuidSchema = lazySchema(() => z.string().check(z.uuid()))
const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
const checksumSchema = lazySchema(() => z.string().check(z.regex(/^[a-f0-9]{64}$/)))
export const initiativeDeclarationSelectionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.enum(['CHARACTER_ACTION', 'CHARACTER_SPELL_CAST', 'CREATURE_FEATURE_ACTION']),
      optionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000))
    }),
    z
      .strictObject({
        kind: z.literal('GM_ADJUDICATED'),
        optionId: z.literal('GM_ADJUDICATED'),
        actorSize: systemCoreCodeSchema,
        factorIds: z.array(uuidSchema).check(z.maxLength(32)),
        spellLevel: z.nullable(z.number().check(z.int()).check(z.gte(0)).check(z.lte(99)))
      })
      .check(
        z.superRefine((value, context) => {
          if (new Set(value.factorIds).size !== value.factorIds.length) {
            context.addIssue({
              code: 'custom',
              path: ['factorIds'],
              message: 'GM-adjudicated action factors must be unique.'
            })
          }
        })
      )
  ])
)
export type InitiativeDeclarationSelectionDto = z.infer<
  typeof initiativeDeclarationSelectionDtoSchema
>

export const commandBaseDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: uuidSchema,
    commandId: uuidSchema,
    expectedVersion: versionSchema
  })
)

const optionalCombatActionIntentSelectionValueDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ENTITY'),
      entityId: postgresUuidSchema
    }),
    z.strictObject({
      kind: z.literal('POSITION'),
      position: spatialPointDtoSchema
    })
  ])
)
const optionalCombatActionIntentSelectionDtoSchema = lazySchema(() =>
  z.strictObject({
    fieldId: checksumSchema,
    value: optionalCombatActionIntentSelectionValueDtoSchema
  })
)

export const optionalCombatActionIntentDtoSchema = lazySchema(() =>
  z
    .strictObject({
      optionId: checksumSchema,
      definitionId: postgresUuidSchema,
      selectionContract: checksumSchema,
      selections: z.array(optionalCombatActionIntentSelectionDtoSchema).check(z.maxLength(4))
    })
    .check(
      z.superRefine((intent, context) => {
        for (let index = 1; index < intent.selections.length; index += 1) {
          if (intent.selections[index - 1]!.fieldId >= intent.selections[index]!.fieldId) {
            context.addIssue({
              code: 'custom',
              path: ['selections', index, 'fieldId'],
              message: 'Optional combat intent selection field IDs must be unique and ascending.'
            })
          }
        }
      })
    )
)
export type OptionalCombatActionIntentDto = z.infer<typeof optionalCombatActionIntentDtoSchema>

/**
 * The submitter's explicit consent to stow this exact item: its shield for a two-handed attack, or
 * a held weapon, for free, to free the hand an action needs (D152).
 */
export const encounterShieldStowDtoSchema = lazySchema(() =>
  z.strictObject({ kind: z.literal('STOW_SHIELD'), shieldItemInstanceId: uuidSchema })
)
export const encounterHeldWeaponStowDtoSchema = lazySchema(() =>
  z.strictObject({ kind: z.literal('STOW_HELD_WEAPON'), itemInstanceId: uuidSchema })
)
export const encounterAcceptedWieldConflictDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [encounterShieldStowDtoSchema, encounterHeldWeaponStowDtoSchema])
)
export type EncounterAcceptedWieldConflictDto = z.infer<
  typeof encounterAcceptedWieldConflictDtoSchema
>

/**
 * What a RESOLVE_ACTION aims at: one creature, the creatures a chosen-creature spell names (Mass
 * Healing Word; `scene` is the Scene version the caster saw, null when the action reads no
 * positions, and the point a shaped list is centered on), the origin of a point-area action (AREA_CONTENTS
 * targeting), or the origin and direction of a directed area (a cone, a line, or a cube from the
 * caster's own side), in the coordinates of the Scene version the caster saw. A directed
 * area's origin must lie on the caster's token footprint. A caster-centered area (a Self sphere,
 * cylinder or circle) takes no aim: it names only the Scene version it is fenced to.
 */
/** Creatures the caster designates at cast that a zone the action places never affects. */
const unaffectedActorIdsSchema = lazySchema(() =>
  z.optional(z.array(uuidSchema).check(z.minLength(1)).check(z.maxLength(MAX_ENCOUNTER_ACTORS)))
)

export const resolveEncounterActionTargetDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ACTOR'),
      actorId: uuidSchema,
      /** The option the caster picks at cast, for an action that offers several (D148). */
      choiceOptionId: z.optional(postgresUuidSchema),
      /**
       * The target's equipped item the action is used on, for an action that chooses one
       * (Shillelagh's club, Heat Metal's armor): Disarm's item choice.
       */
      boundItemInstanceId: z.optional(postgresUuidSchema),
      /** The target's held effect a one-chosen end-effects action ends (Lesser Restoration's pick). */
      chosenEffectId: z.optional(postgresUuidSchema),
      /** The ammunition stack a weapon attack fires, when several fit (ATTACK-19.4). */
      ammunitionItemInstanceId: z.optional(postgresUuidSchema)
    }),
    z.strictObject({
      kind: z.literal('ACTORS'),
      /** The option the caster picks at cast, for an action that offers several (D148). */
      choiceOptionId: z.optional(postgresUuidSchema),
      /** The ammunition stack an attack list (Volley) fires, one piece per creature (ATTACK-19.4). */
      ammunitionItemInstanceId: z.optional(postgresUuidSchema),
      /** One entry per creature, or per dart for an action that allows repeated targets. */
      actorIds: z.array(uuidSchema).check(z.minLength(1)).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      /** The form the creatures take, for an action that authors forms (Giant Insect); absent otherwise. */
      formId: z.optional(postgresUuidSchema),
      /** The Creature the target becomes, for an action whose form is a rule-filtered choice (Polymorph); absent otherwise. */
      creatureId: z.optional(postgresUuidSchema),
      scene: z.nullable(
        z.strictObject({
          sceneId: uuidSchema,
          expectedSceneVersion: versionSchema,
          point: z.nullable(spatialPointDtoSchema)
        })
      )
    }),
    z.strictObject({
      kind: z.literal('POINT'),
      sceneId: uuidSchema,
      expectedSceneVersion: versionSchema,
      point: spatialPointDtoSchema,
      unaffectedActorIds: unaffectedActorIdsSchema,
      /** The zone the caster picks at cast, for an action that offers several (D140). */
      choiceOptionId: z.optional(postgresUuidSchema)
    }),
    z.strictObject({
      kind: z.literal('DIRECTED'),
      sceneId: uuidSchema,
      expectedSceneVersion: versionSchema,
      origin: spatialPointDtoSchema,
      toward: spatialPointDtoSchema
    }),
    z.strictObject({
      kind: z.literal('CASTER_CENTERED'),
      sceneId: uuidSchema,
      expectedSceneVersion: versionSchema,
      unaffectedActorIds: unaffectedActorIdsSchema,
      /** The zone the caster picks at cast, for an action that offers several (D140). */
      choiceOptionId: z.optional(postgresUuidSchema)
    }),
    /** A straight wall from one endpoint to the other (D154). */
    z.strictObject({
      kind: z.literal('WALL'),
      sceneId: uuidSchema,
      expectedSceneVersion: versionSchema,
      from: spatialPointDtoSchema,
      to: spatialPointDtoSchema,
      /** The side of travel from `from` to `to` its band reaches, when the zone has one (D154). */
      side: z.optional(z.enum(['LEFT', 'RIGHT'])),
      unaffectedActorIds: unaffectedActorIdsSchema,
      /** The zone the caster picks at cast, for an action that offers several (D140). */
      choiceOptionId: z.optional(postgresUuidSchema)
    }),
    /** A ring around `center`, `outerRadius` in Scene coordinates (D154). */
    z.strictObject({
      kind: z.literal('RING'),
      sceneId: uuidSchema,
      expectedSceneVersion: versionSchema,
      center: spatialPointDtoSchema,
      outerRadius: z.number().check(z.positive()),
      /** Whether its band reaches inside or outside the ring, when the zone has one (D154). */
      side: z.optional(z.enum(['INSIDE', 'OUTSIDE'])),
      unaffectedActorIds: unaffectedActorIdsSchema,
      /** The zone the caster picks at cast, for an action that offers several (D140). */
      choiceOptionId: z.optional(postgresUuidSchema)
    })
  ])
)
export type ResolveEncounterActionTargetDto = z.infer<typeof resolveEncounterActionTargetDtoSchema>

/** A target that aims an area rather than names a creature. */
export type AreaActionTargetDto = Exclude<
  ResolveEncounterActionTargetDto,
  { kind: 'ACTOR' | 'ACTORS' }
>

/** The option or zone the caster picked at cast (D140, D148); a directed area takes none. */
export function castChoiceOptionId(target: ResolveEncounterActionTargetDto): string | undefined {
  return 'choiceOptionId' in target ? target.choiceOptionId : undefined
}

/** The ammunition a weapon attack fires: the stack the command names, and one piece per target. */
export function ammunitionCommandChoice(target: ResolveEncounterActionTargetDto) {
  return {
    itemInstanceId:
      'ammunitionItemInstanceId' in target ? target.ammunitionItemInstanceId : undefined,
    attacks: target.kind === 'ACTORS' ? target.actorIds.length : 1
  }
}

/** The creature a single-target action aims at; an area or a creature list names none. */
export function actionTargetActorId(target: ResolveEncounterActionTargetDto): string {
  if (target.kind !== 'ACTOR') throw new Error('Only a single-target action names one creature.')
  return target.actorId
}

/**
 * Where an aimed area action's area starts: the picked point, the directed area's origin, a wall's
 * first endpoint or a ring's center. A caster-centered area has none in its command (it starts at
 * the caster's token), so it is not accepted.
 */
export function areaActionTargetOrigin(
  target: Exclude<AreaActionTargetDto, { kind: 'CASTER_CENTERED' }>
): SpatialPointDto {
  switch (target.kind) {
    case 'POINT':
      return target.point
    case 'DIRECTED':
      return target.origin
    case 'WALL':
      return target.from
    case 'RING':
      return target.center
  }
}

const encounterActionIdSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)

export const resolveEncounterActionInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('RESOLVE_ACTION'),
    actorId: uuidSchema,
    actionId: encounterActionIdSchema,
    target: resolveEncounterActionTargetDtoSchema,
    optionalCombatIntent: z.optional(z.nullable(optionalCombatActionIntentDtoSchema)),
    /**
     * Set only on a root the rules raise themselves, never on one a player submits: the committed
     * command whose result raised it. Admission proves the link against that command's receipt.
     */
    systemTrigger: z.optional(
      z.strictObject({
        parentCommandId: uuidSchema,
        /**
         * Absent for the default, reaching 0 hit points. RULE: an optional combat rule's own action,
         * raised by the rule's failed save the parent receipt records.
         */
        trigger: z.optional(z.enum(['START_OF_TURN', 'RULE']))
      })
    ),
    acceptedWieldConflict: z._default(
      z.optional(z.nullable(encounterAcceptedWieldConflictDtoSchema)),
      null
    ),
    /**
     * The GM's Public/Private choice for rolls of GM-controlled creatures this action makes (Q14).
     * Used only when the Campaign owner submits it; otherwise the owner's stored preference applies.
     */
    visibility: z.optional(rollVisibilityDtoSchema),
    /** Assisted-mode warnings the submitter chose to override ("Do it anyway"). */
    acknowledgedWarnings: z._default(z.optional(encounterAcknowledgedRuleWarningsDtoSchema), []),
    /**
     * Required only by action policies that consume exact Scene position. The
     * server locks and validates this dependency before it constructs facts.
     */
    sceneContext: z._default(
      z.optional(
        z.nullable(
          z.strictObject({
            sceneId: uuidSchema,
            expectedSceneVersion: versionSchema,
            sourceTokenId: uuidSchema,
            targetTokenId: uuidSchema
          })
        )
      ),
      null
    )
  })
)

/** A CHECK action (First Aid, Help, Dash...): it aims at one creature, never a point. */
export const resolveCheckActionInputDtoSchema = lazySchema(() =>
  z.extend(resolveEncounterActionInputDtoSchema, {
    target: z.strictObject({
      kind: z.literal('ACTOR'),
      actorId: uuidSchema,
      /** The outcome the actor picks with the attempt, for a basic action that offers several (D105). */
      choiceOptionId: z.optional(postgresUuidSchema)
    })
  })
)
export type ResolveCheckActionInputDto = z.infer<typeof resolveCheckActionInputDtoSchema>

/** The Scene read for a point-area action: the caster's token and every bound creature token. */
export const actionAreaSceneRequestDtoSchema = lazySchema(() =>
  z.strictObject({
    actorId: uuidSchema,
    sceneId: uuidSchema,
    expectedSceneVersion: versionSchema
  })
)
export type ActionAreaSceneRequestDto = z.infer<typeof actionAreaSceneRequestDtoSchema>

/** The Scene read for one source and one target actor's tokens, however the action names its target. */
export const actionSceneRequestDtoSchema = lazySchema(() =>
  z.extend(z.pick(resolveEncounterActionInputDtoSchema, { actorId: true, sceneContext: true }), {
    targetActorId: uuidSchema,
    /**
     * The action whose range the source token measures. Absent, or any action but a CONJURED
     * repeat, the source token is `actorId`'s; a CONJURED repeat's is the creature its carrier
     * conjured, which the read resolves from the stored carrier.
     */
    actionId: z.optional(encounterActionIdSchema)
  })
)
export type ActionSceneRequestDto = z.infer<typeof actionSceneRequestDtoSchema>

/**
 * The current actor, held by an Encounter relationship effect, spends its escape activation to
 * attempt the module's fixed-DC check (D105). `checkDefinitionId` names one of the check choices
 * the module allows. With `heldActorId`, the actor is a rescuer within reach of that held creature
 * (a module that allows `CREATURE_WITHIN_REACH`) and `activeEffectId` names the effect the held
 * creature carries; absent, the actor escapes for itself.
 */
export const escapeRelationshipInputDtoSchema = lazySchema(() =>
  z
    .extend(commandBaseDtoSchema, {
      type: z.literal('ESCAPE'),
      actorId: uuidSchema,
      heldActorId: z.optional(uuidSchema),
      activeEffectId: postgresUuidSchema,
      checkDefinitionId: postgresUuidSchema,
      /** Assisted-mode warnings the submitter chose to override ("Do it anyway"). */
      acknowledgedWarnings: z._default(z.optional(encounterAcknowledgedRuleWarningsDtoSchema), [])
    })
    .check(
      z.refine(
        ({ actorId, heldActorId }) => heldActorId !== actorId,
        'A creature escapes for itself by omitting the held creature.'
      )
    )
)

/**
 * The current actor ends a grant it holds that lets its holder end it (D113), spending the
 * activation the grant's `holderEnd` names. `activeEffectId` names the grant.
 */
export const endHeldGrantInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('END_HELD_GRANT'),
    actorId: uuidSchema,
    activeEffectId: postgresUuidSchema,
    /** Assisted-mode warnings the submitter chose to override ("Do it anyway"). */
    acknowledgedWarnings: z._default(z.optional(encounterAcknowledgedRuleWarningsDtoSchema), [])
  })
)

/**
 * The current actor takes a live effect offer (D160): the effect `effectId` moves to `target` with its
 * remaining duration and Concentration, spending the activation and reaching the range the offer
 * `offerIndex` names. The offer is re-read from the effect at admission, so a stale pick is refused.
 */
export const moveHeldEffectInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('MOVE_HELD_EFFECT'),
    actorId: uuidSchema,
    effectId: postgresUuidSchema,
    offerIndex: z.number().check(z.int()).check(z.nonnegative()),
    target: z.strictObject({ kind: z.literal('ACTOR'), actorId: uuidSchema }),
    /** Assisted-mode warnings the submitter chose to override ("Do it anyway"). */
    acknowledgedWarnings: z._default(z.optional(encounterAcknowledgedRuleWarningsDtoSchema), []),
    /** The Scene read that measures the offer's range, as for an action. */
    sceneContext: resolveEncounterActionInputDtoSchema.shape.sceneContext
  })
)

/**
 * A creature turns to face `rotationDegrees` as a reaction, on any turn, under the Encounter's
 * Facing rule (ATTACK-12). Its bound token on the Encounter's Scene turns with it.
 */
export const changeFacingInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('CHANGE_FACING'),
    actorId: uuidSchema,
    rotationDegrees: sceneTokenFacingCommandInputDtoSchema.shape.rotationDegrees,
    /** Assisted-mode warnings the submitter chose to override ("Do it anyway"). */
    acknowledgedWarnings: z._default(z.optional(encounterAcknowledgedRuleWarningsDtoSchema), [])
  })
)

/**
 * The source of an Encounter relationship lets go of the creature it holds (D152): free, and
 * whenever it likes. `activeEffectId` names the relationship effect `heldActorId` carries.
 */
export const releaseRelationshipInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('RELEASE_RELATIONSHIP'),
    actorId: uuidSchema,
    heldActorId: uuidSchema,
    activeEffectId: postgresUuidSchema
  })
)

const requestIdSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256))
)

/** A d20 row's roll mode. The rules-derived mode is recommended; the roller may change it. */
export const encounterD20RollModeDtoSchema = lazySchema(() => systemCoreCodeSchema)
export type EncounterD20RollModeDto = z.infer<typeof encounterD20RollModeDtoSchema>

/** Faces the roller entered ("Entered by <name>"): two for advantage or disadvantage. */
const enterDiceResolutionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('ENTER_DICE'),
    requestId: requestIdSchema,
    rawFaces: z
      .array(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)))
      .check(z.minLength(1))
      .check(z.maxLength(2)),
    /** One of the request's offered `rollModes`; the server derives which face it keeps. */
    rollMode: encounterD20RollModeDtoSchema,
    /** The faces of the request's added dice (D156). */
    addedFaces: z.optional(d20AddedFacesDtoSchema)
  })
)

/**
 * Settles the request with the roller's latest app roll for it ("Rolled by the app"). The server
 * reads the recorded faces; a client never supplies an app roll's values.
 */
const systemRollResolutionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('SYSTEM_ROLL'),
    requestId: requestIdSchema,
    rollId: uuidSchema
  })
)

export const resolveRuleOccurrenceInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('RESOLVE_RULE_OCCURRENCE'),
    correlationId: z._default(z.optional(serverRuleExecutionCorrelationIdDtoSchema), null),
    occurrenceId: uuidSchema,
    expectedOccurrenceVersion: versionSchema,
    resolution: z.discriminatedUnion('kind', [
      enterDiceResolutionDtoSchema,
      systemRollResolutionDtoSchema,
      /** A contest defender picks one of its sealed checks and rolls it in one step (D152). */
      z
        .strictObject({
          kind: z.literal('CONTEST_CHECK'),
          requestId: requestIdSchema,
          checkDefinitionId: postgresUuidSchema,
          roll: z.discriminatedUnion('kind', [
            enterDiceResolutionDtoSchema,
            systemRollResolutionDtoSchema
          ])
        })
        .check(
          z.superRefine((value, context) => {
            if (value.roll.requestId !== value.requestId)
              context.addIssue({
                code: 'custom',
                path: ['roll', 'requestId'],
                message: 'A contest check rolls its own request.'
              })
          })
        ),
      z.strictObject({
        kind: z.literal('ENTER_INTEGER'),
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        value: z.number().check(z.int())
      }),
      z.strictObject({
        kind: z.literal('INITIATIVE_ENTITY'),
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        entityId: uuidSchema
      }),
      z.strictObject({
        kind: z.literal('INITIATIVE_DECLARATION'),
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        primary: initiativeDeclarationSelectionDtoSchema,
        bonus: z.nullable(initiativeDeclarationSelectionDtoSchema)
      }),
      ...movementReactionChoiceSelectionDtoSchema._zod.def.options,
      /**
       * One creature's Legendary Resistance decision on its failed area save, answered in any order
       * relative to the other creatures. `USE` names the option the creature's offer sealed.
       */
      z.strictObject({
        kind: z.literal('AREA_LEGENDARY_RESISTANCE'),
        actorId: uuidSchema,
        decision: z.discriminatedUnion('kind', [
          z.strictObject({ kind: z.literal('USE'), optionId: checksumSchema }),
          z.strictObject({ kind: z.literal('DECLINE') })
        ])
      }),
      /** The square the source chooses for a creature its action pushes, from the offered ones (D157). */
      z.strictObject({
        kind: z.literal('FORCED_MOVEMENT'),
        requestId: requestIdSchema,
        position: spatialPointDtoSchema
      }),
      /** The roller lets a held die go unused after seeing the d20. */
      z.strictObject({ kind: z.literal('D20_WINDOW_DECLINE'), requestId: requestIdSchema }),
      /**
       * The roller adds a held die the window offered. `faces` are the die's entered faces; absent,
       * the server rolls it.
       */
      z.strictObject({
        kind: z.literal('D20_WINDOW_USE'),
        requestId: requestIdSchema,
        optionId: checksumSchema,
        faces: z.optional(d20AddedFacesDtoSchema)
      }),
      z.strictObject({ kind: z.literal('PASSAGE_DECLINE') }),
      z.strictObject({ kind: z.literal('PASSAGE_OPTION'), optionId: checksumSchema }),
      /** A Legendary Action option and the actor it targets, from the option's targets. */
      z.strictObject({
        kind: z.literal('LEGENDARY_OPTION'),
        optionId: checksumSchema,
        targetActorId: uuidSchema
      })
    ])
  })
)
/**
 * "Roll dice" on one prompt row: the server rolls this request with secure randomness, records the
 * roll and posts it to the table log without settling the request. Rerolls are further attempts.
 */
export const rollRuleEvidenceInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('ROLL_RULE_EVIDENCE'),
    occurrenceId: uuidSchema,
    expectedOccurrenceVersion: versionSchema,
    requestId: requestIdSchema,
    /** The chosen mode for a d20 row; null for any other roll. */
    rollMode: z.nullable(encounterD20RollModeDtoSchema),
    /** The GM's Public/Private choice (Q14); used only when the Campaign owner rolls. */
    visibility: z.optional(rollVisibilityDtoSchema)
  })
)
/** GM escape hatch for a stuck decision; the outcome depends on the pending decision's kind. */
export const voidRuleOccurrenceInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('VOID_RULE_OCCURRENCE'),
    occurrenceId: uuidSchema,
    expectedOccurrenceVersion: versionSchema
  })
)
/**
 * GM-only: takes one creature out of a pending area before its save is answered. The checksum is the
 * caught set the GM saw; a changed set refuses the command as stale.
 */
export const removeAreaTargetInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('REMOVE_AREA_TARGET'),
    occurrenceId: uuidSchema,
    expectedOccurrenceVersion: versionSchema,
    expectedCaughtChecksum: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
    actorId: uuidSchema
  })
)
/**
 * GM-only: adds creatures to or removes them from the observers one concealment (a hidden creature)
 * is hidden from, for a change the table fiction made that the rules cannot see, such as lighting.
 * It changes only the observer set of an existing concealment.
 */
export const setConcealmentObserversInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('SET_CONCEALMENT_OBSERVERS'),
    activeEffectId: uuidSchema,
    add: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    remove: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
  })
)
/**
 * GM-only (MOVE-3.2): places an environmental zone, authored through the same zone node map as
 * authored content, fixed to the Scene with its origin at `point`. It has no source creature, so
 * its saves use their authored fixed DC. A spot DC conceals it from every player (MOVE-3.3).
 */
export const placeZoneInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('PLACE_ZONE'),
    zone: manifestDtoSchema,
    point: spatialPointDtoSchema,
    spotDc: z.optional(zoneDcDtoSchema),
    disarmDc: z.optional(zoneDcDtoSchema)
  })
)
/**
 * GM-only (MOVE-3.3): sets or clears a placed zone's spot DC and disarm DC; null clears one. A zone
 * with a spot DC is concealed from every player whose Characters do not know of it, and clearing it
 * puts the zone in plain sight.
 */
export const setZoneDcsInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('SET_ZONE_DCS'),
    spatialEffectId: postgresUuidSchema,
    spotDc: z.nullable(zoneDcDtoSchema),
    disarmDc: z.nullable(zoneDcDtoSchema)
  })
)
/** GM-only (MOVE-3.5): settles a Character's prompted sighting of a concealed zone without revealing it. */
export const dismissZoneSightingInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('DISMISS_ZONE_SIGHTING'),
    spatialEffectId: postgresUuidSchema,
    actorId: uuidSchema
  })
)
/**
 * GM-only morale save (ENCOUNTER-6.1): checks one of the actor's offered or GM-declared triggers.
 * `leaderActorId` names the group's leader for a group trigger; null rolls the fallback roller. The
 * GM enters the d20 faces or the server rolls them under the save's frozen roll mode.
 */
export const moraleSaveInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('MORALE_SAVE'),
    actorId: uuidSchema,
    triggerKind: moraleTriggerKindDtoSchema,
    leaderActorId: z.nullable(uuidSchema),
    overwhelmingOpposition: z.boolean(),
    /** False proposes surrender instead of flight on a failed save. */
    escapePossible: z.boolean(),
    roll: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('AUTO_ROLL') }),
      z.omit(enterDiceResolutionDtoSchema, { requestId: true })
    ]),
    visibility: rollVisibilityDtoSchema
  })
)
/** GM-only: confirms the actor's proposed morale outcome or picks another (ENCOUNTER-6.2). */
export const confirmMoraleInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('CONFIRM_MORALE'),
    actorId: uuidSchema,
    disposition: moraleDispositionDtoSchema
  })
)
/**
 * GM-only: accepts a consequence-table roll offer (ATTACK-15), which the server rolls, or declines
 * it. The offer is the actor's one its source command made on that table. An accepted roll posts with
 * `visibility`.
 */
export const resolveConsequenceRollOfferInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('RESOLVE_CONSEQUENCE_ROLL_OFFER'),
    actorId: uuidSchema,
    sourceCommandId: uuidSchema,
    definitionId: uuidSchema,
    decision: z.enum(['ACCEPT', 'DECLINE']),
    visibility: rollVisibilityDtoSchema
  })
)
/** GM-only exact undo of the Run's last committed action and its committed children. */
export const revertLastEncounterActionInputDtoSchema = lazySchema(() =>
  z.extend(commandBaseDtoSchema, {
    type: z.literal('REVERT_LAST_ACTION')
  })
)
export type ResolveEncounterActionInputDto = z.infer<typeof resolveEncounterActionInputDtoSchema>
export type EscapeRelationshipInputDto = z.infer<typeof escapeRelationshipInputDtoSchema>
export type EndHeldGrantInputDto = z.infer<typeof endHeldGrantInputDtoSchema>
export type MoveHeldEffectInputDto = z.infer<typeof moveHeldEffectInputDtoSchema>
export type ChangeFacingInputDto = z.infer<typeof changeFacingInputDtoSchema>
export type ReleaseRelationshipInputDto = z.infer<typeof releaseRelationshipInputDtoSchema>
export type ResolveRuleOccurrenceInputDto = z.infer<typeof resolveRuleOccurrenceInputDtoSchema>
export type VoidRuleOccurrenceInputDto = z.infer<typeof voidRuleOccurrenceInputDtoSchema>
export type RemoveAreaTargetInputDto = z.infer<typeof removeAreaTargetInputDtoSchema>
export type SetConcealmentObserversInputDto = z.infer<typeof setConcealmentObserversInputDtoSchema>
export type PlaceZoneInputDto = z.infer<typeof placeZoneInputDtoSchema>
export type SetZoneDcsInputDto = z.infer<typeof setZoneDcsInputDtoSchema>
export type DismissZoneSightingInputDto = z.infer<typeof dismissZoneSightingInputDtoSchema>
export type RollRuleEvidenceInputDto = z.infer<typeof rollRuleEvidenceInputDtoSchema>
export type MoraleSaveInputDto = z.infer<typeof moraleSaveInputDtoSchema>
export type ConfirmMoraleInputDto = z.infer<typeof confirmMoraleInputDtoSchema>
export type ResolveConsequenceRollOfferInputDto = z.infer<
  typeof resolveConsequenceRollOfferInputDtoSchema
>
export type RevertLastEncounterActionInputDto = z.infer<
  typeof revertLastEncounterActionInputDtoSchema
>
