import { z, lazySchema } from '../zod.js'

import { abilityCodeSchema, spellSlotPoolCodeSchema } from '../shared/enums.js'

const integerSchema = lazySchema(() => z.number().check(z.int()))
const booleanSchema = lazySchema(() => z.boolean())

const boundedIdentitySchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)

export const characterSpellGrantAttributeSchema = lazySchema(() =>
  z.enum([
    'CONCENTRATION',
    'RITUAL',
    'LIMITED_USE',
    'PREPARED',
    'KNOWN',
    'CAST_AT_WILL',
    'CAST_AT_LEVEL',
    'SELF_ONLY'
  ])
)

export const characterSpellChargeDescriptorSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      id: boundedIdentitySchema,
      limitKind: z.string().check(z.regex(/^[A-Z][A-Z0-9_]{0,79}$/)),
      resetKind: z.nullable(z.string().check(z.regex(/^[A-Z][A-Z0-9_]{0,79}$/)))
    })
  )
)

const characterSpellAccessCandidateSchema = lazySchema(() =>
  z.strictObject({
    sequence: integerSchema.check(z.gte(0)).check(z.lte(999)),
    accessId: boundedIdentitySchema,
    sourceInstanceId: boundedIdentitySchema,
    spellId: boundedIdentitySchema,
    sourceFeatureId: boundedIdentitySchema,
    grantId: boundedIdentitySchema,
    sourceKind: z.enum(['CLASS', 'SUBCLASS', 'RACE', 'SUBRACE', 'FEAT', 'BACKGROUND', 'OPTION']),
    sourceId: boundedIdentitySchema,
    /** The acquisition owning a chosen OPTION source; null for every other source kind. */
    acquiredParentId: z._default(z.nullable(boundedIdentitySchema), null),
    owningClassId: z.nullable(boundedIdentitySchema),
    activeSourceLevel: integerSchema.check(z.gte(1)).check(z.lte(20)),
    featureAvailableAtLevel: integerSchema.check(z.gte(1)).check(z.lte(20)),
    inheritedFeatureDuplicate: booleanSchema,
    specializationId: z.nullable(boundedIdentitySchema),
    specializationRestrictionIds: z.nullable(
      z.array(boundedIdentitySchema).check(z.maxLength(100))
    ),
    selectionKind: z.enum(['GRANTED', 'CHOSEN']),
    authoringMode: z.enum(['ALL', 'SELECTED']),
    selectedByCharacter: booleanSchema,
    scalingKind: z.enum(['NONE', 'PER_LEVEL']),
    scalingSource: z.nullable(
      z.enum(['CHARACTER_LEVEL', 'CLASS_LEVEL', 'PARENT_CLASS_LEVEL', 'SPELL_CAST_LEVEL'])
    ),
    progressionLevel: z.nullable(integerSchema.check(z.gte(1)).check(z.lte(20))),
    totalLevel: integerSchema.check(z.gte(0)).check(z.lte(20)),
    classLevel: z.nullable(integerSchema.check(z.gte(1)).check(z.lte(20))),
    attributes: z.array(characterSpellGrantAttributeSchema).check(z.maxLength(16)),
    castAtLevel: z.nullable(integerSchema.check(z.gte(1)).check(z.lte(9))),
    castingAbility: z.nullable(abilityCodeSchema),
    charge: characterSpellChargeDescriptorSchema,
    /** The creature types the grant narrows its casts to (D156); empty for none. */
    allowedCreatureTypeIds: z._default(z.array(boundedIdentitySchema).check(z.maxLength(100)), []),
    /** Whether each creature a cast targets is locked out of this grant until the caster's long rest. */
    perTargetLockout: z._default(booleanSchema, false),
    /** The slot pool each cast also spends a slot from (D175); null when the grant spends none. */
    slotPoolCode: z._default(z.nullable(spellSlotPoolCodeSchema), null)
  })
)

export const characterSpellAccessCandidatesSchema = lazySchema(() =>
  z
    .array(characterSpellAccessCandidateSchema)
    .check(z.maxLength(1000))
    .check(
      z.superRefine((candidates, context) => {
        for (const [index, candidate] of candidates.entries()) {
          if (candidate.sequence !== index) {
            context.addIssue({
              code: 'custom',
              message: 'Spell access candidates must use contiguous source order',
              path: [index, 'sequence']
            })
          }
        }
      })
    )
)
