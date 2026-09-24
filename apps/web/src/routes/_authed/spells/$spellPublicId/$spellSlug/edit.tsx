import { createFileRoute, redirect } from '@tanstack/react-router'
import { spellResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { spellAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { getSpell } from '#app/data/spells/queries'
import type { SpellEditLoaderData } from '#app/routes/-routeLoaderData'
import { loadAuthoredRouteSystem } from '#app/routes/-authoredRouteSystem'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/spells/$spellPublicId/$spellSlug/edit')({
  context: () => createAuthoredFormRouteContext('spell', 'edit'),
  loader: async ({ context, params }): Promise<SpellEditLoaderData> => {
    const [active, working] = await Promise.all([
      context.queryClient.ensureQueryData(getSpell(params.spellPublicId)),
      context.queryClient.ensureQueryData(getSpell({ id: params.spellPublicId, view: 'draft' }))
    ])
    const response = spellResponseDtoSchema.parse(active)
    const draft = spellResponseDtoSchema.parse(working)?.draft ?? null
    const spellId = response?.item?.id ?? draft?.subjectId ?? params.spellPublicId
    const routeSubject = getAuthoredRouteSubject(spellId, response, draft)
    const parsedDraft = spellAuthoringInputDtoSchema.safeParse(draft?.payload)
    const currentSpell = parsedDraft.success ? parsedDraft.data : response?.item
    const systemId = currentSpell?.systemId ?? draft?.systemId
    const system = await loadAuthoredRouteSystem(context.queryClient, systemId)

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
      subjectId: spellId,
      system
    })
  },
  component: AuthoringLayout
})
