import { AUTHORED_LIMITS } from '@artificer-toolkit/shared/utils/authoringLimits'
import { z } from 'zod'

export { AUTHORED_LIMITS }

export const authoredIdentifierSchema = z.string().max(AUTHORED_LIMITS.shortTextCharacters)
export const authoredShortTextSchema = z.string().max(AUTHORED_LIMITS.shortTextCharacters)
export const authoredPlainTextSchema = z.string().max(AUTHORED_LIMITS.plainTextCharacters)
export const authoredNonnegativeNumberSchema = z.number().nonnegative()
export const authoredRichTextSchema = z
  .string()
  .max(AUTHORED_LIMITS.richTextSerializedCharacters)
  .refine(
    (value) => getVisibleRichTextLength(value) <= AUTHORED_LIMITS.richTextVisibleCharacters,
    `Rich text must contain at most ${AUTHORED_LIMITS.richTextVisibleCharacters} visible characters`
  )

export const authoredNestedCollectionSchema = <TItem extends z.ZodType>(item: TItem) =>
  z.array(item).max(AUTHORED_LIMITS.nestedCollectionItems)

export const authoredReferenceCollectionSchema = <TItem extends z.ZodType>(item: TItem) =>
  z.array(item).max(AUTHORED_LIMITS.referenceCollectionItems)

function getVisibleRichTextLength(value: string): number {
  return value
    .replace(/<\/?[a-z][^<>]*>/gi, '')
    .replace(/&(?:#\d{1,7}|#x[\da-f]{1,6}|amp|apos|gt|lt|nbsp|quot);/gi, 'x').length
}
