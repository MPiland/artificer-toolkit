import type { z } from 'zod'
import type { AuthoredDraftDto } from '@artificer-toolkit/schema/api/content'

export interface ParsedAuthoredDraft<TValue> {
  draft: AuthoredDraftDto | null
  item: TValue | undefined
  isInvalid: boolean
}

export function parseAuthoredDraftPayload<TValue>(
  draft: AuthoredDraftDto | null,
  schema: z.ZodType<TValue>
): ParsedAuthoredDraft<TValue> {
  if (!draft) {
    return {
      draft,
      item: undefined,
      isInvalid: false
    }
  }

  const result = schema.safeParse(draft.payload)
  if (!result.success) {
    return {
      draft,
      item: undefined,
      isInvalid: true
    }
  }

  return {
    draft,
    item: result.data,
    isInvalid: false
  }
}
