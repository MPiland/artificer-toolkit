import type { z } from 'zod'
import type { CharacterBuilderDraftDto } from '@artificer-toolkit/schema/api/characters'

export interface ParsedCharacterBuilderDraft<TValue> {
  draft: CharacterBuilderDraftDto | null
  item: TValue | undefined
  isInvalid: boolean
}

export function parseCharacterBuilderDraftPayload<TValue>(
  draft: CharacterBuilderDraftDto | null,
  schema: z.ZodType<TValue>
): ParsedCharacterBuilderDraft<TValue> {
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
