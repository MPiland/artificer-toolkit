import { z, lazySchema, lazySchemaParts } from '../zod.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from '../shared/activeRuleEffects.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { characterSheetActionDtoSchema } from './characterSheetData.js'
import { resolveEncounterActionInputDtoSchema } from './encounters.js'
import {
  encounterHeldWeaponStowDtoSchema,
  encounterShieldStowDtoSchema
} from './encounterRuleCommands.js'
import { activationCodeSchema, equipmentGripSchema } from '../shared/enums.js'
import { encounterRuleWarningsDtoSchema } from '../shared/encounterRuleWarnings.js'
import { shapeMeasurementDtoSchema } from '../shared/shape.js'
import { basicActionReusableDefinitionDocumentDtoSchema } from '../shared/basicActions.js'
import { targetingSelfDtoSchema } from '../effects/targeting.js'
import { effectOfferRangeDtoSchema, repeatOfferTargetSchema } from '../effects/effectOffer.js'

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

const choiceOptionLabelSchema = lazySchema(() =>
  z.string().check(z.minLength(1)).check(z.maxLength(160))
)

const choiceOptionsSchema = lazySchema(() =>
  z.optional(
    z
      .array(z.strictObject({ id: postgresUuidSchema, label: choiceOptionLabelSchema }))
      .check(z.minLength(2))
  )
)

/**
 * The action is used on an item its creature has equipped (Shillelagh's club, Heat Metal's armor):
 * once the creature is picked the client reads the items it may pick from.
 */
const choosesItemSchema = lazySchema(() => z.optional(z.literal(true)))

/** The caster designates creatures at cast that the zone it places never affects. */
const choosesUnaffectedShape = lazySchemaParts(() => ({
  choosesUnaffected: z.optional(z.literal(true))
}))

/**
 * The band a zone also reaches on the side its caster picks after aiming its wall (D154): the wall
 * plus distance beside it, or inside or outside a ring. Absent when the zone has none.
 */
const sideBandShape = lazySchemaParts(() => ({
  sideBand: z.optional(z.strictObject({ distance: shapeMeasurementDtoSchema }))
}))

/** An area centered on a point the client picks. */
const pointTargetSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('POINT'),
    area: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('RADIUS'), radius: shapeMeasurementDtoSchema }),
      z.strictObject({ kind: z.literal('CUBE'), edgeLength: shapeMeasurementDtoSchema })
    ])
  })
)

/**
 * A radius centered on the caster, measured from the edge of their space (a Self sphere, cylinder
 * or circle), or the caster's own space (a Self area that names no shape): the client asks for no
 * aim and only fences the Scene version.
 */
const casterCenteredTargetSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('CASTER_CENTERED'),
    area: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('RADIUS'), radius: shapeMeasurementDtoSchema }),
      z.strictObject({ kind: z.literal('OWN_SPACE') })
    ])
  })
)

/**
 * A straight wall between two endpoints the client picks (D154): at most `maxLength` long, with
 * `thickness` centered on the segment.
 */
const wallTargetSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('WALL'),
    area: z.strictObject({
      maxLength: shapeMeasurementDtoSchema,
      thickness: shapeMeasurementDtoSchema
    }),
    ...sideBandShape()
  })
)

/**
 * A ring around a center the client picks (D154): the client picks its outer radius, at most
 * `maxOuterRadius` and more than `thickness`; the inner radius is the outer one less `thickness`.
 */
const ringTargetSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('RING'),
    area: z.strictObject({
      maxOuterRadius: shapeMeasurementDtoSchema,
      thickness: shapeMeasurementDtoSchema
    }),
    ...sideBandShape()
  })
)

export const MAX_AMMUNITION_CHOICES = 100

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
    /** A spell cast's components as its data names them ("V, S, M (a pearl)"); shown, never enforced (D171). */
    componentsLabel: z.optional(labelSchema),
    attackBonus: z.optional(z.number().check(z.int())),
    damageLabel: z.optional(labelSchema),
    /**
     * The grip of a versatile weapon attack (a Character's item or a Creature's Feature); actions
     * sharing `attackKey` are the same attack offered one- and two-handed. Null for every other action.
     */
    grip: z.nullable(z.strictObject({ value: equipmentGripSchema, attackKey: labelSchema })),
    /**
     * Present when taking this action stows an item: the active shield (with the armor class it
     * costs) or a held weapon that frees the hand the action needs. The client must confirm.
     */
    wieldConflict: z.nullable(
      z.discriminatedUnion('kind', [
        z.extend(encounterShieldStowDtoSchema, {
          armorClassDelta: z.number().check(z.int()).check(z.lte(0))
        }),
        encounterHeldWeaponStowDtoSchema
      ])
    ),
    /**
     * Present when the held creatures fill the hands the action's carried weapon needs to be drawn:
     * the actor must release one of these holds (the existing RELEASE_RELATIONSHIP, free) before
     * the attack, and the room refuses the attack until it does. Absent when the weapon draws
     * itself, needs no draw, or the action is refused for another reason.
     */
    handRelease: z.optional(
      z.strictObject({
        holds: z
          .array(
            z.strictObject({ activeEffectId: postgresUuidSchema, heldActorId: postgresUuidSchema })
          )
          .check(z.minLength(1))
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
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
     * origin and direction of a directed area, a wall's endpoints, a ring's center and size, one of
     * several zones, or nothing for an area centered on the caster. The
     * area is as authored; the client converts it to the Scene's coordinates to preview it.
     */
    target: z.discriminatedUnion('kind', [
      /**
       * The action resolves on its user (Dash, Dodge): the client asks for nothing but the option
       * it picks at use, for one that offers several (Fiendish Resilience's damage type, D148).
       */
      z.strictObject({ kind: z.literal('SELF'), choiceOptions: choiceOptionsSchema }),
      z.strictObject({
        kind: z.literal('ACTOR'),
        /** As authored: the client lists the user among the creatures unless it is `REFUSED` (Help, First Aid). */
        self: targetingSelfDtoSchema,
        /** The options the caster picks one of at cast (D148); absent for an action with none. */
        choiceOptions: choiceOptionsSchema,
        choosesItem: choosesItemSchema,
        /** Only the creatures the user holds (`releases`) may be named (Engulf); the commit refuses any other. */
        heldBySource: z.optional(z.literal(true))
      }),
      /**
       * Up to `maxTargets` creatures the client lists and the user picks (Mass Healing Word), or
       * any number of them, each once, when `maxTargets` is absent (Pass without Trace);
       * `area` is the sphere the picks must stand in, centered on a point the user also picks,
       * null when the spell names creatures without a shape. With `allowRepeatedTargets` each pick
       * is one projectile (Magic Missile's dart), so the same creature may be picked up to
       * `maxTargets` times, which a repeating list always names.
       */
      z
        .strictObject({
          kind: z.literal('ACTORS'),
          maxTargets: z.optional(z.number().check(z.int()).check(z.positive())),
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
        })
        .check(
          z.refine((target) => !target.allowRepeatedTargets || target.maxTargets !== undefined, {
            message: 'A list that repeats creatures names its cap.'
          })
        ),
      z.extend(pointTargetSchema, choosesUnaffectedShape()),
      z.extend(casterCenteredTargetSchema, choosesUnaffectedShape()),
      z.extend(wallTargetSchema, choosesUnaffectedShape()),
      z.extend(ringTargetSchema, choosesUnaffectedShape()),
      /**
       * The zones the caster picks one of at cast (D140, D154): the client picks an option first,
       * then aims it as that option's own target asks.
       */
      z.strictObject({
        kind: z.literal('ZONE_OPTIONS'),
        options: z
          .array(
            z.strictObject({
              id: postgresUuidSchema,
              label: choiceOptionLabelSchema,
              target: z.discriminatedUnion('kind', [
                pointTargetSchema,
                casterCenteredTargetSchema,
                wallTargetSchema,
                ringTargetSchema
              ])
            })
          )
          .check(z.minLength(2)),
        ...choosesUnaffectedShape()
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
     * The ammunition in stock that fits this weapon attack, for the client to pick from; absent for
     * an action that fires none. The client sends its pick as `ammunitionItemInstanceId` (ATTACK-19.4).
     */
    ammunition: z.optional(
      z
        .array(
          z.strictObject({
            itemInstanceId: postgresUuidSchema,
            label: labelSchema,
            quantity: z.number().check(z.int()).check(z.positive())
          })
        )
        .check(z.maxLength(MAX_AMMUNITION_CHOICES))
    ),
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
 * A relationship effect the actor holds and can try to escape (D105): the grapple's offer. The
 * client submits `activeEffectId` and one of the allowed `checks`. `dc` is the fixed DC, or null
 * when the holder contests the escape with its own check (D152). `heldActorId` is the held creature
 * a rescuer within reach frees (ATTACK-7.9), null when the actor escapes for itself; the client
 * submits it with `activeEffectId`.
 */
export const encounterEscapeChoiceDtoSchema = lazySchema(() =>
  z.strictObject({
    heldActorId: z.nullable(postgresUuidSchema),
    activeEffectId: postgresUuidSchema,
    /** "Escape from <grappler>", or "Escape a grapple" when the grappler is hidden from the requester. */
    label: labelSchema,
    dc: z.nullable(z.number().check(z.int()).check(z.positive())),
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

/**
 * A choice a held effect offers the actor beside its holder's turns (D160): the effect-offer pick. The
 * client submits `effectId` and `offerIndex` with its chosen target; the effect names the cost and the
 * range. The actor need not hold the effect: `holderActorId` does.
 */
export const encounterEffectOfferChoiceDtoSchema = lazySchema(() => {
  const base = {
    effectId: postgresUuidSchema,
    offerIndex: z.number().check(z.int()).check(z.nonnegative()),
    holderActorId: postgresUuidSchema,
    /** What taking the offer costs now: FREE for a repeat's unspent free cast-turn use (D190a). */
    activation: activationCodeSchema,
    /** Soft-rule warnings that already apply, as for `actions`. */
    warnings: encounterRuleWarningsDtoSchema
  }
  return z.discriminatedUnion('kind', [
    z.strictObject({
      ...base,
      kind: z.literal('MOVE_HELD_EFFECT'),
      /** The distance the pick reaches. */
      range: effectOfferRangeDtoSchema
    }),
    z.strictObject({
      ...base,
      kind: z.literal('REPEAT_SOURCE_PATH'),
      /**
       * The action the client resolves (D166); it spends the offer's activation. Against the holder,
       * unless `target` is INVOCATION: then the client picks the targets the repeated invocation allows.
       */
      actionId: z.string().check(z.minLength(1)),
      target: z.optional(repeatOfferTargetSchema),
      /**
       * The creature the repeat is measured from, whose token the client sends as the source token:
       * the one the cast conjured (a CONJURED offer). Absent means the actor.
       */
      originActorId: z.optional(postgresUuidSchema),
      /** The cast's name, e.g. the spell, or a generic name when the source is hidden from the reader. */
      label: labelSchema,
      /** The level the cast froze, when the repeat scales with it. */
      castLevel: z.optional(z.number().check(z.int()).check(z.gte(1)).check(z.lte(9))),
      /** The saving throw DC the cast froze, when the repeat forces a save. */
      dc: z.optional(z.number().check(z.int()))
    })
  ])
})

/**
 * A creature the actor holds through a relationship it applied (D152): the release offer, which
 * spends nothing. The client submits `heldActorId` and `activeEffectId`.
 */
export const encounterReleaseChoiceDtoSchema = lazySchema(() =>
  z.strictObject({
    heldActorId: postgresUuidSchema,
    activeEffectId: postgresUuidSchema,
    /** "Release <creature>", or "Release a creature" when the creature is hidden from the requester. */
    label: labelSchema
  })
)

/** A hold a creature the requester controls applied, which its source may release on any turn (D152). */
export const encounterHeldRelationshipDtoSchema = lazySchema(() =>
  z.extend(encounterReleaseChoiceDtoSchema, {
    sourceActorId: postgresUuidSchema,
    /**
     * A `TARGET_DRAGGED` hold's drag: whether its source's moves cost double (D105), from the sizes
     * at read time. Null for a hold that does not drag. The route preview reads it; settlement
     * recomputes it.
     */
    drag: z.nullable(z.strictObject({ doublesCost: z.boolean() }))
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
        /** No required slot is left; whatever `actions` still offers with an `attackSlot` is optional. */
        complete: z.boolean(),
        lastActionId: characterSheetActionDtoSchema.shape.id,
        lastTargetIds: z.array(postgresUuidSchema)
      })
    ),
    actions: z.array(encounterActionChoiceDtoSchema),
    /**
     * The action the drawer starts on (D107): the open Attack action's last weapon, else the
     * main-hand weapon's Action attack, else the off-hand weapon's bonus attack. Null for none.
     */
    defaultActionId: z.nullable(characterSheetActionDtoSchema.shape.id),
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
    /** One entry per live offer of an effect the actor may take, wherever the effect is held. */
    effectOffers: z
      .array(encounterEffectOfferChoiceDtoSchema)
      .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
    /** One entry per creature the actor holds through a relationship it applied. */
    releases: z.array(encounterReleaseChoiceDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    optionalRules: z.array(z.strictObject({ definitionId: postgresUuidSchema, label: labelSchema }))
  })
)

/** A superseded reactive scope has no available choices; authority failures still reject. */
export const encounterActionChoicesResponseDtoSchema = lazySchema(() =>
  z.nullable(encounterActionChoicesDtoSchema)
)

/** The target's items an action that `choosesItem` may be used on, by the picked creature. */
export const getEncounterActionItemChoicesInputDtoSchema = lazySchema(() =>
  z.extend(
    z.pick(resolveEncounterActionInputDtoSchema, {
      encounterId: true,
      expectedVersion: true,
      actorId: true,
      actionId: true
    }),
    {
      encounterId: postgresUuidSchema,
      actorId: postgresUuidSchema,
      targetActorId: postgresUuidSchema
    }
  )
)

/** Each item the client may send as the command's `boundItemInstanceId`, with its label. */
export const encounterActionItemChoicesDtoSchema = lazySchema(() =>
  z.strictObject({
    items: z.array(z.strictObject({ id: postgresUuidSchema, label: labelSchema }))
  })
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
export type EncounterEffectOfferChoiceDto = z.infer<typeof encounterEffectOfferChoiceDtoSchema>
export type EncounterReleaseChoiceDto = z.infer<typeof encounterReleaseChoiceDtoSchema>
export type EncounterHeldRelationshipDto = z.infer<typeof encounterHeldRelationshipDtoSchema>
export type EncounterActionChoicesDto = z.infer<typeof encounterActionChoicesDtoSchema>
export type EncounterActionChoicesResponseDto = z.infer<
  typeof encounterActionChoicesResponseDtoSchema
>
export type GetEncounterActionItemChoicesInputDto = z.infer<
  typeof getEncounterActionItemChoicesInputDtoSchema
>
export type EncounterActionItemChoicesDto = z.infer<typeof encounterActionItemChoicesDtoSchema>
export type GetEncounterOptionalActionChoicesInputDto = z.infer<
  typeof getEncounterOptionalActionChoicesInputDtoSchema
>
export type EncounterOptionalActionChoicesDto = z.infer<
  typeof encounterOptionalActionChoicesDtoSchema
>
