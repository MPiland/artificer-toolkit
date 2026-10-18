import { z, lazySchema } from '../zod.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from '../shared/activeRuleEffects.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { characterSheetActionDtoSchema } from './characterSheetData.js'
import { resolveEncounterActionInputDtoSchema } from './encounters.js'
import { encounterAcceptedWieldConflictDtoSchema } from './encounterRuleCommands.js'
import { activationCodeSchema, equipmentGripSchema } from '../shared/enums.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import { shapeMeasurementDtoSchema } from '../shared/shape.js'
import { basicActionReusableDefinitionDocumentDtoSchema } from '../shared/basicActions.js'
import { targetingSelfDtoSchema } from '../effects/targeting.js'

const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
const labelSchema = lazySchema(() => z.string().check(z.trim()).check(z.minLength(1)))
const checksumSchema = lazySchema(() => z.string().check(z.regex(/^[a-f0-9]{64}$/)))

export const getEncounterActionChoicesInputDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    expectedVersion: versionSchema,
    actorId: postgresUuidSchema
  })
)

const choiceOptionsSchema = lazySchema(() =>
  z.optional(
    z
      .array(
        z.strictObject({
          id: postgresUuidSchema,
          label: z.string().check(z.minLength(1)).check(z.maxLength(160))
        })
      )
      .check(z.minLength(2))
  )
)

export const encounterActionChoiceDtoSchema = lazySchema(() =>
  z.strictObject({
    id: characterSheetActionDtoSchema.shape.id,
    label: characterSheetActionDtoSchema.shape.label,
    sourceLabel: characterSheetActionDtoSchema.shape.sourceLabel,
    /** What the action does, for a System-authored basic action's tooltip. */
    rulesText: z.optional(basicActionReusableDefinitionDocumentDtoSchema.shape.rulesText),
    /** What the action costs to use, shown beside its name: a System basic action's cost, or a spell cast's authored activation. */
    actionCost: z.optional(activationCodeSchema),
    /** The numeric range geometry the compiled target policy enforces; `rangeLabel` words the authored range instead. */
    range: z.optional(
      z.discriminatedUnion('kind', [
        /** The action reaches only its user. */
        z.strictObject({ kind: z.literal('SELF') }),
        /** Touch (5 ft) or a distance without a long range: a reach, a spell's range, the 0 ft swarm space. */
        z.strictObject({ kind: z.literal('WITHIN'), distance: shapeMeasurementDtoSchema }),
        /** A ranged weapon attack: normal range, and disadvantage out to the long range. */
        z.strictObject({
          kind: z.literal('RANGED'),
          normal: shapeMeasurementDtoSchema,
          long: shapeMeasurementDtoSchema
        }),
        z.strictObject({ kind: z.literal('UNLIMITED') })
      ])
    ),
    rangeLabel: z.optional(labelSchema),
    attackBonus: z.optional(z.number().check(z.int())),
    damageLabel: z.optional(labelSchema),
    /**
     * The grip of a versatile weapon attack (a Character's item or a Creature's Feature); actions
     * sharing `attackKey` are the same attack offered one- and two-handed. Null for every other action.
     */
    grip: z.nullable(z.strictObject({ value: equipmentGripSchema, attackKey: labelSchema })),
    /** Present when attacking with this action stows the active shield; the client must confirm. */
    wieldConflict: z.nullable(
      z.extend(encounterAcceptedWieldConflictDtoSchema, {
        armorClassDelta: z.number().check(z.int()).check(z.lte(0))
      })
    ),
    /**
     * Soft-rule warnings that already apply before a target is chosen (no allowance left, item not
     * equipped, not enough uses). The drawer shows the action dimmed with these reasons; resolving it
     * still asks "Do it anyway".
     */
    warnings: encounterRuleWarningsDtoSchema,
    /**
     * What the client picks before resolving: a creature, the point an area is centered on, the
     * origin and direction of a directed area, or nothing for an area centered on the caster. The
     * area is as authored; the client converts it to the Scene's coordinates to preview it.
     */
    target: z.discriminatedUnion('kind', [
      /** The action resolves on its user (Dash, Dodge): the client asks for nothing. */
      z.strictObject({ kind: z.literal('SELF') }),
      z.strictObject({
        kind: z.literal('ACTOR'),
        /** As authored: the client lists the user among the creatures unless it is `REFUSED` (Help, First Aid). */
        self: targetingSelfDtoSchema,
        /** The options the caster picks one of at cast (D148); absent for an action with none. */
        choiceOptions: choiceOptionsSchema
      }),
      /**
       * Up to `maxTargets` creatures the client lists and the user picks (Mass Healing Word);
       * `area` is the sphere the picks must stand in, centered on a point the user also picks,
       * null when the spell names creatures without a shape. With `allowRepeatedTargets` each pick
       * is one projectile (Magic Missile's dart), so the same creature may be picked up to
       * `maxTargets` times.
       */
      z.strictObject({
        kind: z.literal('ACTORS'),
        maxTargets: z.number().check(z.int()).check(z.positive()),
        area: z.nullable(
          z.strictObject({ kind: z.literal('RADIUS'), radius: shapeMeasurementDtoSchema })
        ),
        allowRepeatedTargets: z.optional(z.literal(true)),
        /**
         * The forms the creatures may take (Giant Insect); the user picks one and each caps the
         * picks at its own `maxTargets`. Absent for an action that authors none.
         */
        forms: z.optional(
          z
            .array(
              z.strictObject({
                id: postgresUuidSchema,
                label: z.string().check(z.minLength(1)).check(z.maxLength(160)),
                maxTargets: z.number().check(z.int()).check(z.positive())
              })
            )
            .check(z.minLength(1))
        ),
        /**
         * The action lets the user name any Creature as the form (Polymorph); the Worker checks it
         * against the action's filter at cast.
         */
        choosesCreatureForm: z.optional(z.literal(true)),
        /** The options the caster picks one of at cast (D148); absent for an action with none. */
        choiceOptions: choiceOptionsSchema
      }),
      z.strictObject({
        kind: z.literal('POINT'),
        area: z.discriminatedUnion('kind', [
          z.strictObject({ kind: z.literal('RADIUS'), radius: shapeMeasurementDtoSchema }),
          z.strictObject({ kind: z.literal('CUBE'), edgeLength: shapeMeasurementDtoSchema })
        ]),
        /** The caster designates creatures at cast that the zone it places never affects. */
        choosesUnaffected: z.optional(z.literal(true)),
        /** The zones the caster picks one of at cast (D140); absent for an action with one zone. */
        choiceOptions: choiceOptionsSchema
      }),
      /**
       * A radius centered on the caster, measured from the edge of their space (a Self sphere,
       * cylinder or circle): the client asks for no aim and only fences the Scene version.
       */
      z.strictObject({
        kind: z.literal('CASTER_CENTERED'),
        area: z.strictObject({ kind: z.literal('RADIUS'), radius: shapeMeasurementDtoSchema }),
        /** The caster designates creatures at cast that the zone it places never affects. */
        choosesUnaffected: z.optional(z.literal(true)),
        /** The zones the caster picks one of at cast (D140); absent for an action with one zone. */
        choiceOptions: choiceOptionsSchema
      }),
      /**
       * An area that starts on the caster's own token and extends toward a direction: a cone, a
       * line, or a cube from the caster's side (a cube authored with a Self range).
       */
      z.strictObject({
        kind: z.literal('DIRECTED'),
        area: z.discriminatedUnion('kind', [
          z.strictObject({ kind: z.literal('CONE'), length: shapeMeasurementDtoSchema }),
          z.strictObject({
            kind: z.literal('LINE'),
            length: shapeMeasurementDtoSchema,
            width: z.optional(shapeMeasurementDtoSchema)
          }),
          z.strictObject({
            kind: z.literal('CUBE_FROM_SIDE'),
            edgeLength: shapeMeasurementDtoSchema
          })
        ])
      })
    ]),
    /**
     * The attack of the actor's Attack action this choice would make ("Attack 2 of 3"): a weapon
     * attack that fits the open Attack action, or the first one of a fresh turn. Null for choices that
     * are not part of the Attack action and for attacks that would spend a new Action ("Do it anyway").
     */
    attackSlot: z.nullable(
      z.strictObject({
        number: z.number().check(z.int()).check(z.gte(1)),
        total: z.number().check(z.int()).check(z.gte(1))
      })
    )
  })
)

export const MAX_BASIC_ACTION_CHOICES = 64
export const MAX_ESCAPE_CHECK_CHOICES = 64

/**
 * A relationship effect the actor holds and can try to escape against a fixed DC (D105): the
 * grapple's offer. The client submits `activeEffectId` and one of the allowed `checks`.
 */
export const encounterEscapeChoiceDtoSchema = lazySchema(() =>
  z.strictObject({
    activeEffectId: postgresUuidSchema,
    /** "Escape from <grappler>", or "Escape a grapple" when the grappler is hidden from the requester. */
    label: labelSchema,
    dc: z.number().check(z.int()).check(z.positive()),
    actionCost: activationCodeSchema,
    /** The ability or skill checks the escape allows; the first is the default. */
    checks: z
      .array(z.strictObject({ checkDefinitionId: postgresUuidSchema, label: labelSchema }))
      .check(z.minLength(1))
      .check(z.maxLength(MAX_ESCAPE_CHECK_CHOICES)),
    /** Soft-rule warnings that already apply, as for `actions`. */
    warnings: encounterRuleWarningsDtoSchema
  })
)

/**
 * A grant the actor holds and may end itself (D113): the end-grant offer. The client submits
 * `activeEffectId`; the grant's own `holderEnd` names the cost.
 */
export const encounterHeldGrantEndChoiceDtoSchema = lazySchema(() =>
  z.strictObject({
    activeEffectId: postgresUuidSchema,
    /** "End <grant source>", or "End effect" when the source is hidden from the requester. */
    label: labelSchema,
    actionCost: activationCodeSchema,
    /** Soft-rule warnings that already apply, as for `actions`. */
    warnings: encounterRuleWarningsDtoSchema
  })
)

export const encounterActionChoicesDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    encounterVersion: versionSchema,
    actorId: postgresUuidSchema,
    /** The actor's Attack action this turn, once an attack has opened it. Null before the first attack. */
    openAttackAction: z.nullable(
      z.strictObject({
        made: z.number().check(z.int()).check(z.gte(1)),
        total: z.number().check(z.int()).check(z.gte(1)),
        lastActionId: characterSheetActionDtoSchema.shape.id,
        lastTargetIds: z.array(postgresUuidSchema)
      })
    ),
    actions: z.array(encounterActionChoiceDtoSchema),
    /** Creature actions whose authored mechanics cannot run, with the reason. They never resolve. */
    unavailableActions: z.array(
      z.strictObject({
        id: characterSheetActionDtoSchema.shape.id,
        label: characterSheetActionDtoSchema.shape.label,
        reason: z.string().check(z.minLength(1)).check(z.maxLength(500))
      })
    ),
    /** The System's authored basic actions, resolved like any action through `RESOLVE_ACTION`. */
    basicActionChoices: z
      .array(encounterActionChoiceDtoSchema)
      .check(z.maxLength(MAX_BASIC_ACTION_CHOICES)),
    /** One entry per escapable relationship the actor holds. */
    escapes: z
      .array(encounterEscapeChoiceDtoSchema)
      .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
    /** One entry per grant the actor holds that lets its holder end it. */
    heldGrantEnds: z
      .array(encounterHeldGrantEndChoiceDtoSchema)
      .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
    optionalRules: z.array(z.strictObject({ definitionId: postgresUuidSchema, label: labelSchema }))
  })
)

/** A superseded reactive scope has no available choices; authority failures still reject. */
export const encounterActionChoicesResponseDtoSchema = lazySchema(() =>
  z.nullable(encounterActionChoicesDtoSchema)
)

export const getEncounterOptionalActionChoicesInputDtoSchema = lazySchema(() =>
  z.extend(
    z.pick(resolveEncounterActionInputDtoSchema, {
      encounterId: true,
      expectedVersion: true,
      actorId: true,
      actionId: true,
      sceneContext: true
    }),
    {
      encounterId: postgresUuidSchema,
      actorId: postgresUuidSchema,
      targetActorId: postgresUuidSchema,
      definitionId: postgresUuidSchema
    }
  )
)

/** Display labels accompany the exact server-issued fields; clients submit only the selected IDs. */
export const encounterOptionalActionChoicesDtoSchema = lazySchema(() =>
  z.strictObject({
    definitionId: postgresUuidSchema,
    optionId: checksumSchema,
    selectionContract: checksumSchema,
    label: labelSchema,
    fields: z
      .array(
        z.strictObject({
          fieldId: checksumSchema,
          kind: z.literal('ENTITY'),
          label: labelSchema,
          options: z
            .array(z.strictObject({ id: postgresUuidSchema, label: labelSchema }))
            .check(z.minLength(1))
        })
      )
      .check(z.minLength(1))
      .check(z.maxLength(4))
  })
)

export type GetEncounterActionChoicesInputDto = z.infer<
  typeof getEncounterActionChoicesInputDtoSchema
>
export type EncounterActionChoiceDto = z.infer<typeof encounterActionChoiceDtoSchema>
export type EncounterEscapeChoiceDto = z.infer<typeof encounterEscapeChoiceDtoSchema>
export type EncounterHeldGrantEndChoiceDto = z.infer<typeof encounterHeldGrantEndChoiceDtoSchema>
export type EncounterActionChoicesDto = z.infer<typeof encounterActionChoicesDtoSchema>
export type EncounterActionChoicesResponseDto = z.infer<
  typeof encounterActionChoicesResponseDtoSchema
>
export type GetEncounterOptionalActionChoicesInputDto = z.infer<
  typeof getEncounterOptionalActionChoicesInputDtoSchema
>
export type EncounterOptionalActionChoicesDto = z.infer<
  typeof encounterOptionalActionChoicesDtoSchema
>
