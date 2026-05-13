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
    const characterId = parseAuthoredRouteId(params.characterPublicId)
    const [response, draft] = await Promise.all([
      context.queryClient.ensureQueryData(getCharacterSheet(characterId, client)),
      context.queryClient.ensureQueryData(getCharacterDraft(characterId, client))
    ])
    const fallbackCharacter = !response && !draft
      ? await context.queryClient.ensureQueryData(getCharacter(characterId, client))
      : null
    const breadcrumbLabel = draft?.label ?? response?.identity.label ?? fallbackCharacter?.character.label ?? null
    const characterPublicId = draft?.publicId ?? response?.publicId ?? fallbackCharacter?.publicId ?? params.characterPublicId
    const routeSubject = breadcrumbLabel
      ? {
          id: draft?.characterId ?? response?.meta.characterId ?? fallbackCharacter?.character.id ?? characterId,
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
