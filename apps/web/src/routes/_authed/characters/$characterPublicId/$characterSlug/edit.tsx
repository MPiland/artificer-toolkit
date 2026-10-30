import { createFileRoute, redirect } from '@tanstack/react-router'
import { characterBuilderDraftDtoSchema } from '@artificer-toolkit/schema/api/characterBuilder'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { z } from 'zod/mini'
import { getCharacterBuilderActiveCharacter, getCharacterDraft } from '#app/data/characters/queries'
import {
  isCanonicalAuthoredRouteHandle,
  parseAuthoredRouteId
} from '#app/routing/authoredRouteHandles'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import type { CharacterEditLoaderData } from '#app/routes/-routeLoaderData'
import { createAuthoringRouteLoaderData } from '#forms/layout/authoredFormRouteContext'
import { CharacterBuilderAuthoringRuntime } from '#domains/characters/builder/core/CharacterBuilderAuthoringRuntime'

export const Route = createFileRoute('/_authed/characters/$characterPublicId/$characterSlug/edit')({
  loader: async ({ context, params }): Promise<CharacterEditLoaderData> => {
    const routeCharacterId = parseAuthoredRouteId(params.characterPublicId)
    // The draft and the active Character only: the Builder evaluates in the browser (ADR 0036 S9).
    const [serializedActive, serializedDraft] = await Promise.all([
      context.queryClient.ensureQueryData(getCharacterBuilderActiveCharacter(routeCharacterId)),
      context.queryClient.ensureQueryData(getCharacterDraft(routeCharacterId))
    ])
    const draft = z.nullable(characterBuilderDraftDtoSchema).parse(serializedDraft)
    const activeCharacter = z.nullable(characterAuthoredDtoSchema).parse(serializedActive)
    const breadcrumbLabel = draft?.label ?? activeCharacter?.label ?? null
    const characterPublicId = draft?.publicId ?? params.characterPublicId
    const characterId = draft?.characterId ?? activeCharacter?.id ?? routeCharacterId
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
      activeCharacter,
      breadcrumbLabel,
      characterId,
      draft
    })
  },
  component: function CharacterEditRoute() {
    return (
      <CharacterBuilderAuthoringRuntime data={Route.useLoaderData().authoringData} mode='edit' />
    )
  }
})
