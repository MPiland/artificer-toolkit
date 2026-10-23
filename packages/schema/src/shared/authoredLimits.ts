import {
  AUTHORED_LENGTH_AMOUNT_MAX,
  AUTHORED_LIMITS
} from '@artificer-toolkit/shared/utils/authoringLimits'
import { z, lazySchema } from '../zod.js'
import { lengthUnitCodeSchema } from './enums.js'

export { AUTHORED_LENGTH_AMOUNT_MAX, AUTHORED_LIMITS }

export const MAX_ENCOUNTER_ACTORS = AUTHORED_LIMITS.nestedCollectionItems

/** The reactions one pause offers: a few reaction spells, a scaling one (Absorb Elements) at up to nine slot levels each. */
export const MAX_ENCOUNTER_REACTION_OPTIONS = 36

export const authoredIdentifierSchema = lazySchema(() =>
  z.string().check(z.maxLength(AUTHORED_LIMITS.shortTextCharacters))
)
export const unknownObjectSchema = lazySchema(() => z.record(authoredIdentifierSchema, z.unknown()))
export const authoredShortTextSchema = lazySchema(() =>
  z.string().check(z.maxLength(AUTHORED_LIMITS.shortTextCharacters))
)
export const authoredPlainTextSchema = lazySchema(() =>
  z.string().check(z.maxLength(AUTHORED_LIMITS.plainTextCharacters))
)
export const authoredNonnegativeNumberSchema = lazySchema(() => z.number().check(z.nonnegative()))
export const authoredLengthAmountSchema = lazySchema(() =>
  z.number().check(z.nonnegative()).check(z.lte(AUTHORED_LENGTH_AMOUNT_MAX))
)
/** A typed length: an amount in one of the length units. */
export const authoredLengthSchema = lazySchema(() =>
  z.strictObject({ amount: authoredLengthAmountSchema, unit: lengthUnitCodeSchema })
)
/** "Your speed is equal to your `equalsSpeedId` speed": the length of another of the holder's speeds. */
export const speedEqualsPayloadSchema = lazySchema(() =>
  z.strictObject({ equalsSpeedId: authoredIdentifierSchema })
)

/** A fraction a value is multiplied by, such as 1/2 for "halved" or 0/1 for "reduced to nothing". */
export const authoredFractionSchema = lazySchema(() =>
  z.strictObject({
    numerator: z.number().check(z.int()).check(z.nonnegative()),
    denominator: z.number().check(z.int()).check(z.positive())
  })
)
/** An authored length that must be more than nothing, such as a movement cost or a wall thickness. */
export const authoredPositiveLengthAmountSchema = lazySchema(() =>
  z.number().check(z.positive()).check(z.lte(AUTHORED_LENGTH_AMOUNT_MAX))
)
export const authoredRichTextSchema = lazySchema(() =>
  z
    .string()
    .check(z.maxLength(AUTHORED_LIMITS.richTextSerializedCharacters))
    .check(
      z.refine(
        (value) => getVisibleRichTextLength(value) <= AUTHORED_LIMITS.richTextVisibleCharacters,
        `Rich text must contain at most ${AUTHORED_LIMITS.richTextVisibleCharacters} visible characters`
      )
    )
)

export const authoredNestedCollectionSchema = <TItem extends z.ZodMiniType>(item: TItem) =>
  z.array(item).check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems))

export const authoredReferenceCollectionSchema = <TItem extends z.ZodMiniType>(item: TItem) =>
  z.array(item).check(z.maxLength(AUTHORED_LIMITS.referenceCollectionItems))

function getVisibleRichTextLength(value: string): number {
  return value
    .replace(/<\/?[a-z][^<>]*>/gi, '')
    .replace(/&(?:#\d{1,7}|#x[\da-f]{1,6}|amp|apos|gt|lt|nbsp|quot);/gi, 'x').length
}
