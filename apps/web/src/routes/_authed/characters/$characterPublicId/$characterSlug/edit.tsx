import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  characterBuilderDraftDtoSchema,
  characterBuilderPayloadDtoSchema
} from '@artificer-toolkit/schema/api/characterBuilder'
import { z } from 'zod/mini'
import { getCharacter, getCharacterDraft } from '#app/data/characters/queries'
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
    const routeCharacterId = parseAuthoredRouteId(params.characterPublicId)
    const [serializedPayload, serializedDraft] = await Promise.all([
      context.queryClient.ensureQueryData(getCharacter(routeCharacterId)),
      context.queryClient.ensureQueryData(getCharacterDraft(routeCharacterId))
    ])
    const draft = z.nullable(characterBuilderDraftDtoSchema).parse(serializedDraft)
    const payload = z.nullable(characterBuilderPayloadDtoSchema).parse(serializedPayload)
    const breadcrumbLabel = draft?.label ?? payload?.character.label ?? null
    const characterPublicId = draft?.publicId ?? payload?.publicId ?? params.characterPublicId
    const characterId = draft?.characterId ?? payload?.character.id ?? routeCharacterId
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

    return createAuthoringRouteLoaderData({
      breadcrumbLabel,
      characterId,
      draft,
      payload
    })
  },
  component: AuthoringLayout
})
