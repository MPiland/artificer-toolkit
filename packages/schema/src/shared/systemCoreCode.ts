import { z, lazySchema } from '../zod.js'

/**
 * A code from a System-supplied vocabulary, such as a roll-mode influence (ADR 0039 decision 5). The
 * wire checks its shape only; the System vocabulary capability in `rules-runtime` decides membership
 * wherever the `gameSystemId` is known.
 */
export const systemCoreCodeSchema = lazySchema(() =>
  z.string().check(z.regex(/^[A-Z][A-Z0-9_]{0,63}$/))
)

/** One entry of a System-supplied vocabulary list: its code and the label shown for it. */
export const systemCoreCodeEntrySchema = lazySchema(() =>
  z.strictObject({
    code: systemCoreCodeSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80))
  })
)

export type SystemCoreCodeEntryDto = z.infer<typeof systemCoreCodeEntrySchema>

/**
 * Which face a d20 test keeps: the one face it rolls (FIRST), or the higher or lower of two. The
 * System's roll-mode policy derives it from the roll mode when the roll is made; the wire checks a
 * d20's faces against it and never interprets the mode code.
 */
export const rollModeKeepSchema = lazySchema(() => z.enum(['FIRST', 'HIGHER', 'LOWER']))

export type RollModeKeep = z.infer<typeof rollModeKeepSchema>

/**
 * A roll mode a roller may pick for a d20 request: its code and label from the System's `rollMode`
 * vocabulary, and the `keep` the System derives from it, so a client shows the faces to enter and
 * the one kept without interpreting the code.
 */
export const offeredRollModeSchema = lazySchema(() =>
  z.extend(systemCoreCodeEntrySchema, { keep: rollModeKeepSchema })
)

export type OfferedRollModeDto = z.infer<typeof offeredRollModeSchema>

/** The faces a d20 test rolls under a keep: one for FIRST, two for HIGHER and LOWER. */
export const rollModeKeepFaceCount = (keep: RollModeKeep): 1 | 2 => (keep === 'FIRST' ? 1 : 2)

/** The face a d20 test counts: the first for FIRST, the higher or lower of the rolled faces otherwise. */
export const rollModeKeptFace = (keep: RollModeKeep, faces: readonly number[]): number =>
  keep === 'HIGHER' ? Math.max(...faces) : keep === 'LOWER' ? Math.min(...faces) : faces[0]!
