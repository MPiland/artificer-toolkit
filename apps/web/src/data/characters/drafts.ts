import { safeParse } from 'zod/mini'
import type * as core from 'zod/v4/core'
import type { CharacterBuilderDraftDto } from '@artificer-toolkit/schema/api/characters'

export interface ParsedCharacterBuilderDraft<TValue> {
  draft: CharacterBuilderDraftDto | null
  item: TValue | undefined
  isInvalid: boolean
}

export function parseCharacterBuilderDraftPayload<TValue>(
  draft: CharacterBuilderDraftDto | null,
  schema: core.$ZodType<TValue>
): ParsedCharacterBuilderDraft<TValue> {
  if (!draft) {
    return {
      draft,
      item: undefined,
      isInvalid: false
    }
  }

  const result = safeParse(schema, draft.payload)
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
