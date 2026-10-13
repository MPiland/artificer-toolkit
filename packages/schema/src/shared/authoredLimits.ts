import { AUTHORED_LIMITS } from '@artificer-toolkit/shared/utils/authoringLimits'
import { z, lazySchema } from '../zod.js'

export { AUTHORED_LIMITS }

export const MAX_ENCOUNTER_ACTORS = AUTHORED_LIMITS.nestedCollectionItems

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
/** Largest authored length amount; every length unit converts it to a finite number of feet. */
export const AUTHORED_LENGTH_AMOUNT_MAX = 1_000_000
export const authoredLengthAmountSchema = lazySchema(() =>
  z.number().check(z.nonnegative()).check(z.lte(AUTHORED_LENGTH_AMOUNT_MAX))
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
