import { createFileRoute, redirect } from '@tanstack/react-router'
import { characterBuilderDraftDtoSchema } from '@artificer-toolkit/schema/api/characterBuilder'
import { z } from 'zod/mini'
import { getCharacterDraft, getCharacterSheetSlice } from '#app/data/characters/queries'
import {
  isCanonicalAuthoredRouteHandle,
  parseAuthoredRouteId
} from '#app/routing/authoredRouteHandles'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import type { CharacterSheetLoaderData } from '#app/routes/-routeLoaderData'
import { CharacterSheetPage } from '#domains/characters'

export const Route = createFileRoute('/_authed/characters/$characterPublicId/$characterSlug/')({
  loader: async ({ context, params }): Promise<CharacterSheetLoaderData> => {
    const routeCharacterId = parseAuthoredRouteId(params.characterPublicId)
    const sliceResponse = await context.queryClient.ensureQueryData(
      getCharacterSheetSlice(routeCharacterId, 'COMMON')
    )
    const response = sliceResponse?.slice === 'COMMON' ? sliceResponse.data : null
    const draft = response
      ? null
      : z
          .nullable(characterBuilderDraftDtoSchema)
          .parse(await context.queryClient.ensureQueryData(getCharacterDraft(routeCharacterId)))
    const breadcrumbLabel = draft?.label ?? response?.identity.label ?? null
    const characterPublicId = draft?.publicId ?? response?.publicId ?? params.characterPublicId
    const characterId = draft?.characterId ?? response?.meta.characterId ?? routeCharacterId
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

    return {
      breadcrumbLabel,
      characterId,
      characterPublicId,
      draft,
      response
    }
  },
  component: CharacterSheetPage
})
