import { z, lazySchema } from '../zod.js'
import {
  authEmailConfirmationSearchSchema,
  passwordInputSchema,
  usernameInputSchema
} from './auth.js'
import { rollVisibilityDtoSchema } from './rolls.js'

export const accountEmailConfirmationSearchSchema = lazySchema(() =>
  z.object({
    ...authEmailConfirmationSearchSchema.shape,
    emailChanged: z.optional(z.literal('1'))
  })
)

const nullableTrimmedText = (maxLength: number) =>
  z.pipe(
    z.nullable(z.string().check(z.trim()).check(z.maxLength(maxLength))),
    z.transform((value) => value || null)
  )

/** PRIVATE (the default) shows the profile to its owner only; PUBLIC shows it to any signed-in account. */
export const profileVisibilitySchema = lazySchema(() => z.enum(['PRIVATE', 'PUBLIC']))

export type ProfileVisibilityDto = z.infer<typeof profileVisibilitySchema>

export const accountProfileDtoSchema = lazySchema(() =>
  z.strictObject({
    username: z.nullable(usernameInputSchema),
    bio: z.nullable(z.string().check(z.maxLength(500))),
    visibility: profileVisibilitySchema
  })
)

export type AccountProfileDto = z.infer<typeof accountProfileDtoSchema>

export const accountProfileVisibilityInputSchema = lazySchema(() =>
  z.strictObject({ visibility: profileVisibilitySchema })
)

export const publicProfileInputSchema = lazySchema(() =>
  z.strictObject({ username: usernameInputSchema })
)

/** What a signed-in stranger may see of a PUBLIC profile: never email, ids or preferences. */
export const publicProfileDtoSchema = lazySchema(() =>
  z.strictObject({
    username: usernameInputSchema,
    bio: z.nullable(z.string().check(z.maxLength(500))),
    avatarRevision: z.nullable(z.number())
  })
)

export type PublicProfileDto = z.infer<typeof publicProfileDtoSchema>

export const accountProfileUpdateInputSchema = lazySchema(() =>
  z.strictObject({
    username: z.optional(usernameInputSchema),
    bio: nullableTrimmedText(500)
  })
)

export const accountRollPreferencesDtoSchema = lazySchema(() =>
  z.strictObject({
    autoRollDice: z.boolean(),
    /** The GM's remembered Public/Private roll toggle (Q14); players never read it. */
    gmRollVisibility: rollVisibilityDtoSchema
  })
)

export type AccountRollPreferencesDto = z.infer<typeof accountRollPreferencesDtoSchema>

export const setAutoRollDiceInputSchema = lazySchema(() =>
  z.strictObject({
    autoRollDice: z.boolean()
  })
)

export const setGmRollVisibilityInputSchema = lazySchema(() =>
  z.strictObject({ gmRollVisibility: rollVisibilityDtoSchema })
)

export const accountUsernameStatusDtoSchema = lazySchema(() =>
  z.strictObject({
    status: z.enum(['available', 'taken', 'not_allowed'])
  })
)

export type AccountUsernameStatusDto = z.infer<typeof accountUsernameStatusDtoSchema>

export const accountEmailUpdateInputSchema = lazySchema(() =>
  z.strictObject({
    email: z.string().check(z.trim()).check(z.email())
  })
)

export type AccountEmailUpdateInput = z.infer<typeof accountEmailUpdateInputSchema>

export const accountPasswordUpdateInputSchema = lazySchema(() =>
  z.strictObject({
    email: z.string().check(z.trim()).check(z.email()),
    currentPassword: z.string().check(z.minLength(1)),
    password: passwordInputSchema
  })
)

export type AccountPasswordUpdateInput = z.infer<typeof accountPasswordUpdateInputSchema>

export const accountDeleteInputSchema = lazySchema(() =>
  z.strictObject({
    email: z.string().check(z.trim()).check(z.email()),
    currentPassword: z.string().check(z.minLength(1))
  })
)

export type AccountDeleteInput = z.infer<typeof accountDeleteInputSchema>
