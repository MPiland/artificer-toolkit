import { createFileRoute } from '@tanstack/react-router'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import {
  characterBuilderDraftPayloadDtoSchema
} from '@artificer-toolkit/schema/api/characters'
import { getCharacter, getCharacterDraft } from '#app/data/characters/queries'
import { createServerApi } from '#app/lib/api'
import { CharacterEditPage } from '#domains/characters'

export const Route = createFileRoute('/_authed/characters/$characterId/edit')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    const [response, draft] = await Promise.all([
      context.queryClient.ensureQueryData(getCharacter(params.characterId, client)),
      context.queryClient.ensureQueryData(getCharacterDraft(params.characterId, client))
    ])
    const parsedDraftPayload = draft ? parseCharacterBuilderDraftPayload(draft.payload) : null
    const resolvedDraftPayload = draft && parsedDraftPayload
      ? await client.characters.resolve({
          character: parsedDraftPayload.character,
          mode: draft.mode
        })
      : null
    const draftPayload = resolvedDraftPayload && parsedDraftPayload
      ? {
          ...resolvedDraftPayload,
          builderIntent: parsedDraftPayload.builderIntent
        }
      : null

    return {
      draft,
      draftPayload,
      response
    }
  },
  component: CharacterEditPage
})

function parseCharacterBuilderDraftPayload(payload: Record<string, unknown>) {
  const parsedDraftPayload = characterBuilderDraftPayloadDtoSchema.safeParse(payload)
  if (parsedDraftPayload.success) return parsedDraftPayload.data

  const parsedLegacyCharacter = characterAuthoredDtoSchema.safeParse(payload)
  if (!parsedLegacyCharacter.success) return null

  return {
    character: parsedLegacyCharacter.data
  }
}
