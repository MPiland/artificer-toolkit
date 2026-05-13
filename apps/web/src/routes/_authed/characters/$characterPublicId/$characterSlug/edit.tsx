import { createFileRoute, redirect } from '@tanstack/react-router'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import {
  characterBuilderDraftPayloadDtoSchema
} from '@artificer-toolkit/schema/api/characters'
import { getCharacter, getCharacterDraft } from '#app/data/characters/queries'
import { createServerApi } from '#app/lib/api'
import {
  isCanonicalAuthoredRouteHandle,
  parseAuthoredRouteId
} from '#app/routing/authoredRouteHandles'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import { CharacterEditPage } from '#domains/characters'

export const Route = createFileRoute('/_authed/characters/$characterPublicId/$characterSlug/edit')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const routeCharacterId = parseAuthoredRouteId(params.characterPublicId)
    const [response, draft] = await Promise.all([
      context.queryClient.ensureQueryData(getCharacter(routeCharacterId, client)),
      context.queryClient.ensureQueryData(getCharacterDraft(routeCharacterId, client))
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
    const breadcrumbLabel = draft?.label ?? response?.character.label ?? null
    const characterPublicId = draft?.publicId ?? response?.publicId ?? params.characterPublicId
    const characterId = draft?.characterId ?? response?.character.id ?? routeCharacterId
    const routeSubject = breadcrumbLabel
      ? {
          id: characterId,
          publicId: characterPublicId,
          label: breadcrumbLabel
        }
      : null
    if (routeSubject && !isCanonicalAuthoredRouteHandle(params.characterPublicId, params.characterSlug, routeSubject)) {
      throw redirect({
        params: buildCharacterRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true,
        to: '/characters/$characterPublicId/$characterSlug/edit'
      })
    }

    if (characterId !== routeCharacterId) {
      context.queryClient.setQueryData(getCharacter(characterId, client).queryKey, response)
      context.queryClient.setQueryData(getCharacterDraft(characterId, client).queryKey, draft)
    }

    return {
      breadcrumbLabel,
      characterId,
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
