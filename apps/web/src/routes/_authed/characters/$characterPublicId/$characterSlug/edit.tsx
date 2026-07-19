import { createFileRoute, redirect } from '@tanstack/react-router'
import { characterBuilderDraftPayloadDtoSchema } from '@artificer-toolkit/schema/api/characters'
import { getCharacter, getCharacterDraft } from '#app/data/characters/queries'
import { createServerApi } from '#app/lib/api'
import {
  isCanonicalAuthoredRouteHandle,
  parseAuthoredRouteId
} from '#app/routing/authoredRouteHandles'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import type { CharacterEditLoaderData } from '#app/routes/-routeLoaderData'
import { AuthoringLayout } from '#forms/layout/AuthoringLayout'
import {
  createAuthoringRouteLoaderData,
  createCharacterBuilderRouteContext
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/characters/$characterPublicId/$characterSlug/edit')({
  context: () => createCharacterBuilderRouteContext('edit'),
  loader: async ({ context, params }): Promise<CharacterEditLoaderData> => {
    const client = createServerApi()
    const routeCharacterId = parseAuthoredRouteId(params.characterPublicId)
    const [response, draft] = await Promise.all([
      context.queryClient.ensureQueryData(getCharacter(routeCharacterId, client)),
      context.queryClient.ensureQueryData(getCharacterDraft(routeCharacterId, client))
    ])
    const parsedDraftPayload = draft ? parseCharacterBuilderDraftPayload(draft.payload) : null
    const resolvedDraftPayload =
      draft && parsedDraftPayload
        ? await client.characters.resolve({
            character: parsedDraftPayload.character,
            mode: draft.mode
          })
        : null
    const draftPayload =
      resolvedDraftPayload && parsedDraftPayload
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
    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.characterPublicId, params.characterSlug, routeSubject)
    ) {
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

    return createAuthoringRouteLoaderData({
      breadcrumbLabel,
      characterId,
      draft,
      draftPayload,
      response
    })
  },
  component: AuthoringLayout
})

function parseCharacterBuilderDraftPayload(payload: Record<string, unknown>) {
  const parsedDraftPayload = characterBuilderDraftPayloadDtoSchema.safeParse(payload)
  return parsedDraftPayload.success ? parsedDraftPayload.data : null
}
