import { createFileRoute, redirect } from '@tanstack/react-router'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { getSpell, getSpellDraft } from '#app/data/spells/queries'
import type { SpellEditLoaderData } from '#app/routes/-routeLoaderData'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/spells/$spellPublicId/$spellSlug/edit')({
  context: () => createAuthoredFormRouteContext('spell', 'edit'),
  loader: async ({ context, params }): Promise<SpellEditLoaderData> => {
    const client = createServerApi()
    const spellId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.spells.list(),
      publicId: params.spellPublicId,
      queryClient: context.queryClient,
      subjectKind: 'SPELL'
    })
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, getSpell(spellId, client)),
      context.queryClient.ensureQueryData(getSpellDraft(spellId, client))
    ])
    const routeSubject = getAuthoredRouteSubject(spellId, response, draft)

    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.spellPublicId, params.spellSlug, routeSubject)
    ) {
      throw redirect({
        to: '/spells/$spellPublicId/$spellSlug/edit',
        params: buildSpellRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return createAuthoredFormRouteLoaderData({
      breadcrumbLabel: routeSubject?.label,
      draft,
      response,
      subjectId: spellId
    })
  },
  component: AuthoringLayout
})
