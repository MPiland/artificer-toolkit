import { z, lazySchema, lazySchemaParts } from '../zod.js'
import {
  modifierKindSchema,
  modifierScopeKindSchema,
  valueDomainCodeSchema
} from '../shared/enums.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'
import { modifierDomainParamsDtoSchema, modifierPayloadDtoSchema } from '../grants/modifier.js'
import { senseRangeDtoSchema } from '../grants/sense.js'
import { postgresUuidSchema as serverUuidIdentityDtoSchema } from '../shared/postgresUuid.js'

export const CHARACTER_GRANT_FOLD_MODEL_KEY = 'character-grant-fold'

const identitySchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)
const codeSchema = lazySchema(() => z.string().check(z.regex(/^[A-Z][A-Z0-9_]{0,79}$/)))

/** An equipment item instance as a mechanic source: the Equipment and the Character's item. */
export const equipmentInstanceMechanicSourceSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('EQUIPMENT_INSTANCE'),
    equipmentId: identitySchema,
    itemInstanceId: identitySchema
  })
)

export const characterMechanicSourceSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('AUTHORED'),
      sourceKind: z.enum([
        'ANCESTRY',
        'BACKGROUND',
        'CLASS',
        'FEAT',
        'FEATURE',
        'OPTION',
        'RACE',
        'SPELL',
        'SUBRACE',
        'SUBCLASS'
      ]),
      definitionId: identitySchema,
      sourceInstanceId: identitySchema
    }),
    equipmentInstanceMechanicSourceSchema,
    z.strictObject({ kind: z.literal('SYSTEM'), systemId: identitySchema }),
    z.strictObject({
      kind: z.literal('COMPANION_INSTANCE'),
      creatureId: identitySchema,
      companionInstanceId: identitySchema
    }),
    z.strictObject({ kind: z.literal('MANUAL_ADJUSTMENT'), adjustmentId: identitySchema }),
    z.strictObject({ kind: z.literal('ACTIVE_EFFECT'), activeEffectId: identitySchema })
  ])
)

const restrictionConditionSchema = lazySchema(() =>
  z.strictObject({
    conditionId: identitySchema,
    constraint: z.enum(['INCLUDE', 'EXCLUDE']),
    kind: z.enum([
      'ABILITY_SCORE',
      'HERITAGE',
      'CHARACTER_LEVEL',
      'CLASS_LEVEL',
      'FEAT_OBTAINED',
      'FEATURE_OBTAINED',
      'OPTION_OBTAINED',
      /**
       * A class entry's subclass is in `requiredIds` (any subclass when empty) and its stored
       * specialization is in `secondaryRequiredIds` (any specialization in ALL mode).
       */
      'SUBCLASS_SPECIALIZATION',
      'SPELL_OBTAINED',
      'CAN_CAST_SPELL',
      /** Holder-state conditions are decided live in an Encounter, never by the fold. */
      'CAN_ACT',
      'SPEED_ABOVE_ZERO',
      'FREE_HAND',
      /** The holder moved at most `max` feet and/or `speedFraction` of its speed this turn (Encounter state). */
      'TURN_MOVEMENT',
      /** The holder carries an active effect authored as one of `requiredIds` (Encounter state). */
      'HOLDER_ACTIVE_EFFECT',
      /** An Attack-action weapon attack with `requiredProperties` was made this turn (Encounter state). */
      'ATTACK_ACTION_OTHER_WEAPON',
      /** An enemy of the attack's target that can act stands within `max` feet of it (Encounter state). */
      'ENEMY_NEAR_TARGET',
      /** The attack's target has not taken a turn in the Encounter yet (Encounter state). */
      'TARGET_HAS_NOT_TAKEN_TURN',
      /** The holder stands in bright light on its Scene, in daylight when `requiresDaylight` (Encounter state). */
      'HOLDER_IN_BRIGHT_LIGHT',
      /**
       * The holder is of a kind in `requiredIds` (CHARACTER or CREATURE): each facet context gates on
       * its subject. The Character fold decides it as a constant; an Encounter reads the holder (D152).
       */
      'HOLDER_KIND',
      /** The Creature holder's type is in `requiredIds` (any type in ALL mode); never a Character. */
      'CREATURE_TYPE',
      /**
       * The source creature's type is in `requiredIds` (any type in ALL mode): the attacker of an
       * attack against the holder, the source of the effect a save, condition or ended effect
       * comes from. Decided where that source is known, never by the fold.
       */
      'SOURCE_CREATURE_TYPE',
      /** The source attack carries a trait in `requiredIds` (magical); decided where the attack is known. */
      'SOURCE_TRAIT',
      'PROFICIENCY',
      'EQUIPMENT_EQUIPPED',
      'SOURCE_STATE',
      'SIZE',
      /** Item conditions are evaluated against the attacking item, never Character-wide. */
      'ITEM_IDENTITY',
      'ITEM_CATEGORY',
      'ITEM_PROPERTY',
      /** The attacking item is the only weapon wielded: no other weapon is equipped. */
      'ITEM_SOLE_WEAPON',
      /** The attack uses the ability named by `abilityId`. */
      'ITEM_ATTACK_ABILITY',
      /** The attack is made with an activation in `requiredIds` (the bonus action of an off-hand attack). */
      'ITEM_ACTIVATION',
      /**
       * Spell conditions are evaluated against the spell an action casts, never Character-wide:
       * its identity (`requiredIds`), school (`requiredIds`, any in ALL mode), level (`min`..`max`)
       * and the damage type of the damage being modified (`requiredIds`, any in ALL mode).
       */
      'SPELL_IDENTITY',
      'SPELL_SCHOOL',
      'SPELL_LEVEL',
      'SPELL_DAMAGE_TYPE',
      'UNAVAILABLE',
      'UNSUPPORTED'
    ]),
    mode: z.nullable(z.enum(['ALL', 'SELECTED'])),
    abilityId: z.nullable(identitySchema),
    classIds: z.array(identitySchema).check(z.maxLength(20)),
    requiredIds: z.array(identitySchema).check(z.maxLength(200)),
    secondaryRequiredIds: z.array(identitySchema).check(z.maxLength(200)),
    min: z.nullable(z.number()),
    max: z.nullable(z.number()),
    speedFraction: z.nullable(z.number()),
    proficiencyKind: z.nullable(codeSchema),
    minimumRank: z.nullable(z.enum(['HALF', 'FULL', 'DOUBLE'])),
    category: z.nullable(codeSchema),
    requiredProperties: z.array(codeSchema).check(z.maxLength(100)),
    sourceState: z.nullable(z.enum(['CARRIED', 'EQUIPPED', 'ATTUNED'])),
    /** Narrows `HOLDER_IN_BRIGHT_LIGHT` to a Scene lit by the sun; false for every other kind. */
    requiresDaylight: z.boolean()
  })
)

export const characterGrantFoldRestrictionSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        conditions: z.array(restrictionConditionSchema).check(z.maxLength(100))
      })
    )
    .check(z.maxLength(50))
)

const proficiencyOperationSchema = lazySchema(() =>
  z
    .strictObject({
      grantId: identitySchema,
      proficiencyKind: codeSchema,
      targetIds: z.array(identitySchema).check(z.maxLength(200)),
      matchIds: z.array(identitySchema).check(z.maxLength(200)),
      category: z.nullable(codeSchema),
      scaling: z.enum(['HALF', 'FULL', 'DOUBLE'])
    })
    .check(
      z.refine(
        ({ targetIds, matchIds }) => targetIds.length === matchIds.length,
        'Proficiency targets and match identities must align.'
      )
    )
)

const scalingTargetsSchema = lazySchema(() =>
  z.strictObject({
    level: z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)),
    targetIds: z.array(identitySchema).check(z.maxLength(200))
  })
)

const scalingOperationSchema = lazySchema(() =>
  z.strictObject({
    grantId: identitySchema,
    scalingKind: z.enum(['NONE', 'PER_LEVEL']),
    targetIds: z.array(identitySchema).check(z.maxLength(200)),
    levels: z.array(scalingTargetsSchema).check(z.maxLength(20))
  })
)

export const senseOperationSchema = lazySchema(() =>
  z.extend(scalingOperationSchema, {
    grantId: identitySchema,
    range: senseRangeDtoSchema
  })
)

/** A compiled modifier grant's typed fields, as the fold carries them (ADR 0003). */
const foldModifierShape = lazySchemaParts(() => ({
  valueDomainCode: valueDomainCodeSchema,
  modifierKind: modifierKindSchema,
  scope: modifierScopeKindSchema,
  domain: modifierDomainParamsDtoSchema,
  payload: z.optional(modifierPayloadDtoSchema)
}))

export const modifierOperationSchema = lazySchema(() =>
  z.strictObject({
    grantId: identitySchema,
    ...foldModifierShape(),
    restrictions: characterGrantFoldRestrictionSchema,
    /** The class resources a RESOURCE-scoped modifier (a charge reset) applies to; empty is all. */
    scopeResourceIds: z.array(identitySchema).check(z.maxLength(500))
  })
)

export const characterGrantFoldSourceSchema = lazySchema(() =>
  z.strictObject({
    sourceId: identitySchema,
    mechanicSource: characterMechanicSourceSchema,
    /**
     * The item a source's SOURCE-scoped modifiers are bound to (Shillelagh's staff): they apply
     * while that item is evaluated instead of the source itself. Absent for every unbound source.
     */
    boundSourceId: z.optional(identitySchema),
    sourceState: z.nullable(
      z.strictObject({ carried: z.boolean(), equipped: z.boolean(), attuned: z.boolean() })
    ),
    restrictions: characterGrantFoldRestrictionSchema,
    proficiencies: z.array(proficiencyOperationSchema).check(z.maxLength(200)),
    senses: z.array(senseOperationSchema).check(z.maxLength(200)),
    modifiers: z.array(modifierOperationSchema).check(z.maxLength(200)),
    feats: z.array(scalingOperationSchema).check(z.maxLength(200)),
    spells: z.array(scalingOperationSchema).check(z.maxLength(200))
  })
)

const classSourceSchema = lazySchema(() =>
  z.strictObject({
    classId: identitySchema,
    level: z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)),
    base: z.nullable(
      z.strictObject({
        category: z.enum(['BASE', 'SUBCLASS']),
        source: characterGrantFoldSourceSchema,
        multiclassProficiencies: z.array(proficiencyOperationSchema).check(z.maxLength(200))
      })
    ),
    subclass: z.nullable(
      z.strictObject({
        category: z.enum(['BASE', 'SUBCLASS']),
        parentClassId: z.nullable(identitySchema),
        source: characterGrantFoldSourceSchema
      })
    )
  })
)

const featureSourceSchema = lazySchema(() =>
  z.strictObject({
    sourceKind: z.enum([
      'ANCESTRY',
      'BACKGROUND',
      'CLASS',
      'FEAT',
      'FEATURE',
      'OPTION',
      'RACE',
      'SUBRACE',
      'SUBCLASS',
      'MANUAL'
    ]),
    sourceClassLevel: z.nullable(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20))),
    timingLevel: z.nullable(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20))),
    definition: z.nullable(characterGrantFoldSourceSchema),
    selectedOptions: z.array(characterGrantFoldSourceSchema).check(z.maxLength(100)),
    featDefinition: z.nullable(characterGrantFoldSourceSchema)
  })
)

const equipmentItemSchema = lazySchema(() =>
  z.strictObject({
    instanceId: identitySchema,
    equipmentId: identitySchema,
    requiresAttunement: z.boolean(),
    equipped: z.boolean(),
    attuned: z.boolean(),
    restrictions: characterGrantFoldRestrictionSchema,
    rootSourceId: identitySchema,
    rootModifiers: z.array(modifierOperationSchema).check(z.maxLength(200)),
    chargeId: z.nullable(identitySchema),
    features: z
      .array(
        z.strictObject({
          source: characterGrantFoldSourceSchema,
          sourceChargeUse: z.nullable(
            z.strictObject({
              featureId: identitySchema,
              limitKind: codeSchema,
              cost: z.number()
            })
          )
        })
      )
      .check(z.maxLength(100))
  })
)

export const characterGrantFoldInputSchema = lazySchema(() =>
  z
    .strictObject({
      contractVersion: z.literal(1),
      base: z.strictObject({
        systemId: identitySchema,
        totalLevel: z.number().check(z.int()).check(z.gte(0)).check(z.lte(20)),
        raceId: z.nullable(identitySchema),
        subraceId: z.nullable(identitySchema),
        size: z.nullable(systemCoreCodeSchema),
        abilities: z.record(identitySchema, z.number()),
        heritageIds: z.array(identitySchema).check(z.maxLength(200)),
        featureIds: z.array(identitySchema).check(z.maxLength(500)),
        optionIds: z.array(identitySchema).check(z.maxLength(500)),
        featIds: z.array(identitySchema).check(z.maxLength(500)),
        classes: z
          .array(
            z.strictObject({
              classId: identitySchema,
              level: z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)),
              spellcasting: z.boolean(),
              subclassId: z.nullable(identitySchema),
              /** The subclass specialization the Builder stored (a Draconic Bloodline's dragon). */
              specializationId: z.nullable(identitySchema)
            })
          )
          .check(z.maxLength(20)),
        equipment: z
          .array(
            z.strictObject({
              equipmentId: identitySchema,
              /** Variant ancestry, nearest parent first. */
              parentEquipmentIds: z.array(identitySchema).check(z.maxLength(20)),
              category: z.nullable(codeSchema),
              properties: z.array(codeSchema).check(z.maxLength(100)),
              equipped: z.boolean(),
              attuned: z.boolean()
            })
          )
          .check(z.maxLength(500))
      }),
      upstreamSpellIds: z.array(identitySchema).check(z.maxLength(5000)),
      classes: z.array(classSourceSchema).check(z.maxLength(20)),
      background: z.nullable(characterGrantFoldSourceSchema),
      features: z.array(featureSourceSchema).check(z.maxLength(500)),
      /** Active effects held by the Character, folded like unrestricted feature sources. */
      activeEffects: z.array(characterGrantFoldSourceSchema).check(z.maxLength(64)),
      equipmentItems: z.array(equipmentItemSchema).check(z.maxLength(500))
    })
    .check(
      z.refine(
        (value) => JSON.stringify(value).length <= 240_000,
        'Grant-fold facts are too large.'
      )
    )
)

const proficiencyResultSchema = lazySchema(() =>
  z.strictObject({
    acceptedProficiencyIndex: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9_999)),
    kind: codeSchema,
    subjectId: identitySchema,
    matchId: identitySchema,
    category: z.optional(codeSchema),
    scaling: z.enum(['HALF', 'FULL', 'DOUBLE']),
    source: characterMechanicSourceSchema,
    grantId: identitySchema
  })
)

const senseResultSchema = lazySchema(() =>
  z.strictObject({
    senseDefinitionId: serverUuidIdentityDtoSchema,
    range: senseRangeDtoSchema,
    acceptedSenseIndex: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9_999)),
    grantId: identitySchema,
    source: characterMechanicSourceSchema
  })
)

export const characterGrantFoldModifierSchema = lazySchema(() =>
  z.strictObject({
    domainKey: identitySchema,
    grantId: identitySchema,
    ...foldModifierShape(),
    /** The granting source; a SOURCE-scoped modifier applies only while it is evaluated. */
    sourceId: identitySchema,
    /** The item a SOURCE-scoped modifier is bound to, evaluated in place of its source. */
    boundSourceId: z.optional(identitySchema),
    source: characterMechanicSourceSchema,
    scopeResourceIds: z.optional(z.array(identitySchema).check(z.maxLength(500))),
    /**
     * Conditions still to be met where they are known, as OR-of-AND groups: the attacking item's,
     * the cast spell's, or the holder's state in the Encounter. Empty means the modifier is
     * unconditional; a Character-wide value never satisfies a non-empty requirement.
     */
    deferredRequirements: characterGrantFoldRestrictionSchema
  })
)

const equipmentChargeUseSchema = lazySchema(() =>
  z.strictObject({
    featureId: identitySchema,
    equipmentId: identitySchema,
    itemInstanceId: identitySchema,
    chargeId: identitySchema,
    cost: z.number()
  })
)

export const characterGrantFoldOutputSchema = lazySchema(() =>
  z
    .strictObject({
      proficiencies: z.array(proficiencyResultSchema).check(z.maxLength(10_000)),
      senses: z.array(senseResultSchema).check(z.maxLength(10_000)),
      modifiers: z.array(characterGrantFoldModifierSchema).check(z.maxLength(10_000)),
      unlockedFeatIds: z.array(identitySchema).check(z.maxLength(10_000)),
      unlockedSpellIds: z.array(identitySchema).check(z.maxLength(10_000)),
      activeSourceIds: z.array(identitySchema).check(z.maxLength(10_000)),
      activeEquipmentInstanceIds: z.array(identitySchema).check(z.maxLength(500)),
      equipmentFeatureChargeUses: z.array(equipmentChargeUseSchema).check(z.maxLength(10_000)),
      modifierGroups: z
        .array(
          z.strictObject({
            domainKey: identitySchema,
            valueDomainCode: valueDomainCodeSchema,
            modifierKind: modifierKindSchema,
            contributions: z
              .array(
                z.strictObject({
                  acceptedModifierIndex: z
                    .number()
                    .check(z.int())
                    .check(z.gte(0))
                    .check(z.lte(9_999)),
                  sourceId: identitySchema,
                  grantId: identitySchema
                })
              )
              .check(z.maxLength(10_000))
          })
        )
        .check(z.maxLength(10_000))
    })
    .check(
      z.refine(
        (value) => JSON.stringify(value).length <= 240_000,
        'Grant-fold result is too large.'
      )
    )
)

export type CharacterGrantFoldInput = z.infer<typeof characterGrantFoldInputSchema>
export type CharacterGrantFoldOutput = z.infer<typeof characterGrantFoldOutputSchema>
export type CharacterGrantFoldRestriction = z.infer<typeof characterGrantFoldRestrictionSchema>
export type CharacterGrantFoldSource = z.infer<typeof characterGrantFoldSourceSchema>
export type CharacterGrantFoldModifier = z.infer<typeof modifierOperationSchema>
export type CharacterGrantFoldSense = z.infer<typeof senseOperationSchema>
export type EquipmentInstanceMechanicSource = z.infer<typeof equipmentInstanceMechanicSourceSchema>
