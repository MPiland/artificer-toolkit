import { z, lazySchema } from '../zod.js'

/**
 * How much of an actor's health other players see (ADR 0034 decision 5). Hidden is the default for
 * every Character and for an Encounter's enemies and NPCs. The GM always sees exact values.
 */
export const healthDisplayLevelDtoSchema = lazySchema(() =>
  z.enum(['HIDDEN', 'DESCRIPTIVE', 'BAR', 'EXACT'])
)
export type HealthDisplayLevelDto = z.infer<typeof healthDisplayLevelDtoSchema>

export const healthDescriptiveStateDtoSchema = lazySchema(() =>
  z.enum(['UNHURT', 'HURT', 'BLOODIED', 'NEAR_DEATH'])
)
export type HealthDescriptiveStateDto = z.infer<typeof healthDescriptiveStateDtoSchema>

/** Bar ratios are rounded to this step so exact hit points cannot be reconstructed. */
export const HEALTH_BAR_RATIO_STEP = 0.05

/** Only what the actor's level allows; a Hidden actor carries no health at all (`null`). */
export const playerActorHealthDtoSchema = lazySchema(() =>
  z.discriminatedUnion('level', [
    z.strictObject({
      level: z.literal('DESCRIPTIVE'),
      state: healthDescriptiveStateDtoSchema
    }),
    z.strictObject({
      level: z.literal('BAR'),
      ratio: z
        .number()
        .check(z.gte(0))
        .check(z.lte(1))
        .check(
          z.refine((ratio) => {
            const steps = ratio / HEALTH_BAR_RATIO_STEP
            return Math.abs(steps - Math.round(steps)) < 1e-9
          }, 'Health bar ratios use a coarse step.')
        )
    }),
    z.strictObject({
      level: z.literal('EXACT'),
      current: z.number().check(z.int()).check(z.nonnegative()),
      maximum: z.number().check(z.int()).check(z.nonnegative())
    })
  ])
)
export type PlayerActorHealthDto = z.infer<typeof playerActorHealthDtoSchema>

/** What a Character's own player shares with the rest of the party. */
export const characterPartyVisibilityDtoSchema = lazySchema(() =>
  z.strictObject({
    /** "Party can view": other players may read the Sheet, without personality and background. */
    sheet: z.boolean(),
    /** "Show my health to the party". */
    health: healthDisplayLevelDtoSchema
  })
)
export type CharacterPartyVisibilityDto = z.infer<typeof characterPartyVisibilityDtoSchema>

export const DEFAULT_CHARACTER_PARTY_VISIBILITY: CharacterPartyVisibilityDto = {
  sheet: false,
  health: 'HIDDEN'
}
