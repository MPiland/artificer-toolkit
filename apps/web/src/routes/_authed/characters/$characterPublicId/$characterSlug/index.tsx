import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCharacter, getCharacterDraft, getCharacterSheet } from '#app/data/characters/queries'
import { createServerApi } from '#app/lib/api'
import {
  isCanonicalAuthoredRouteHandle,
  parseAuthoredRouteId
} from '#app/routing/authoredRouteHandles'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import { CharacterSheetPage } from '#domains/characters'

export const Route = createFileRoute('/_authed/characters/$characterPublicId/$characterSlug/')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const routeCharacterId = parseAuthoredRouteId(params.characterPublicId)
    const [response, draft] = await Promise.all([
      context.queryClient.ensureQueryData(getCharacterSheet(routeCharacterId, client)),
      context.queryClient.ensureQueryData(getCharacterDraft(routeCharacterId, client))
    ])
    const fallbackCharacter = !response && !draft
      ? await context.queryClient.ensureQueryData(getCharacter(routeCharacterId, client))
      : null
    const breadcrumbLabel = draft?.label ?? response?.identity.label ?? fallbackCharacter?.character.label ?? null
    const characterPublicId = draft?.publicId ?? response?.publicId ?? fallbackCharacter?.publicId ?? params.characterPublicId
    const characterId = draft?.characterId ?? response?.meta.characterId ?? fallbackCharacter?.character.id ?? routeCharacterId
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
        to: '/characters/$characterPublicId/$characterSlug'
      })
    }

    if (characterId !== routeCharacterId) {
      context.queryClient.setQueryData(getCharacterSheet(characterId, client).queryKey, response)
      context.queryClient.setQueryData(getCharacterDraft(characterId, client).queryKey, draft)
      if (fallbackCharacter) {
        context.queryClient.setQueryData(getCharacter(characterId, client).queryKey, fallbackCharacter)
      }
    }

    return {
      breadcrumbLabel,
      characterId,
      characterPublicId,
      draft,
      fallbackCharacter,
      response
    }
  },
  component: CharacterSheetPage
})
