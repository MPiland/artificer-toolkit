import { AUTHORED_LIMITS } from '@artificer-toolkit/shared/utils/authoringLimits'
import { z } from '../zod.js'

export { AUTHORED_LIMITS }

export const MAX_ENCOUNTER_ACTORS = AUTHORED_LIMITS.nestedCollectionItems

export const authoredIdentifierSchema = z
  .string()
  .check(z.maxLength(AUTHORED_LIMITS.shortTextCharacters))
export const unknownObjectSchema = z.record(authoredIdentifierSchema, z.unknown())
export const authoredShortTextSchema = z
  .string()
  .check(z.maxLength(AUTHORED_LIMITS.shortTextCharacters))
export const authoredPlainTextSchema = z
  .string()
  .check(z.maxLength(AUTHORED_LIMITS.plainTextCharacters))
export const authoredNonnegativeNumberSchema = z.number().check(z.nonnegative())
export const authoredRichTextSchema = z
  .string()
  .check(z.maxLength(AUTHORED_LIMITS.richTextSerializedCharacters))
  .check(
    z.refine(
      (value) => getVisibleRichTextLength(value) <= AUTHORED_LIMITS.richTextVisibleCharacters,
      `Rich text must contain at most ${AUTHORED_LIMITS.richTextVisibleCharacters} visible characters`
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
