import { z, lazySchemaParts } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

const summonPickOptionsSchema = () =>
  z.optional(
    z
      .array(
        z.strictObject({
          id: postgresUuidSchema,
          label: z.string().check(z.minLength(1)).check(z.maxLength(160))
        })
      )
      .check(z.minLength(1))
  )

/**
 * What a cast of a summon of a chosen form asks its caster to pick, in the room and on the Sheet
 * (SPELLS-34.T3): the System Creatures it may be (Find Familiar), and the Creature Types it may take
 * instead of its own. Each is absent for a summon that offers none.
 */
export const summonPickOptionsShape = lazySchemaParts(() => ({
  summonForms: summonPickOptionsSchema(),
  creatureTypes: summonPickOptionsSchema()
}))

/** The form and Creature Type a summon cast picked; absent for a cast that picks neither. */
export const summonPicksShape = lazySchemaParts(() => ({
  formId: z.optional(postgresUuidSchema),
  creatureTypeId: z.optional(postgresUuidSchema)
}))
