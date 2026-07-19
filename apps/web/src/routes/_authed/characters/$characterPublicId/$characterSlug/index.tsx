import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCharacter, getCharacterDraft, getCharacterSheet } from '#app/data/characters/queries'
import { createServerApi } from '#app/lib/api'
import {
  isCanonicalAuthoredRouteHandle,
  isLegacyAuthoredRouteId,
  parseAuthoredRouteId
} from '#app/routing/authoredRouteHandles'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import type { CharacterSheetLoaderData } from '#app/routes/-routeLoaderData'
import { CharacterSheetPage } from '#domains/characters'

export const Route = createFileRoute('/_authed/characters/$characterPublicId/$characterSlug/')({
  loader: async ({ context, params }): Promise<CharacterSheetLoaderData> => {
    const client = createServerApi()
    const routeCharacterId = parseAuthoredRouteId(params.characterPublicId)
    const routeUsesCanonicalId = isLegacyAuthoredRouteId(routeCharacterId)
    const [response, draft] = routeUsesCanonicalId
      ? await Promise.all([
          context.queryClient.ensureQueryData(getCharacterSheet(routeCharacterId, client)),
          context.queryClient.ensureQueryData(getCharacterDraft(routeCharacterId, client))
        ])
      : await Promise.all([
          client.characters.sheet(routeCharacterId),
          client.characters.getDraft(routeCharacterId)
        ])
    const fallbackCharacter =
      !response && !draft
        ? routeUsesCanonicalId
          ? await context.queryClient.ensureQueryData(getCharacter(routeCharacterId, client))
          : await client.characters.get(routeCharacterId)
        : null
    const breadcrumbLabel =
      draft?.label ?? response?.identity.label ?? fallbackCharacter?.character.label ?? null
    const characterPublicId =
      draft?.publicId ??
      response?.publicId ??
      fallbackCharacter?.publicId ??
      params.characterPublicId
    const characterId =
      draft?.characterId ??
      response?.meta.characterId ??
      fallbackCharacter?.character.id ??
      routeCharacterId
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
        to: '/characters/$characterPublicId/$characterSlug'
      })
    }

    if (!routeUsesCanonicalId || characterId !== routeCharacterId) {
      context.queryClient.setQueryData(getCharacterSheet(characterId, client).queryKey, response)
      context.queryClient.setQueryData(getCharacterDraft(characterId, client).queryKey, draft)
      if (fallbackCharacter) {
        context.queryClient.setQueryData(
          getCharacter(characterId, client).queryKey,
          fallbackCharacter
        )
      }
      context.queryClient.removeQueries({
        exact: true,
        queryKey: getCharacterSheet(routeCharacterId, client).queryKey
      })
      context.queryClient.removeQueries({
        exact: true,
        queryKey: getCharacterDraft(routeCharacterId, client).queryKey
      })
      context.queryClient.removeQueries({
        exact: true,
        queryKey: getCharacter(routeCharacterId, client).queryKey
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
