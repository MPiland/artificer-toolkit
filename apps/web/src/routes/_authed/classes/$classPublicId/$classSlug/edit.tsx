import { createFileRoute, redirect } from '@tanstack/react-router'
import { getClass, getClassDraft } from '#app/data/classes/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'
import type { ClassEditLoaderData } from '#app/routes/-routeLoaderData'
import { loadAuthoredRouteSystem } from '#app/routes/-authoredRouteSystem'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/classes/$classPublicId/$classSlug/edit')({
  context: () => createAuthoredFormRouteContext('class', 'edit'),
  loader: async ({ context, params }): Promise<ClassEditLoaderData> => {
    const client = createServerApi()
    const classId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.classes.list(),
      publicId: params.classPublicId,
      queryClient: context.queryClient,
      subjectKind: 'CLASS'
    })
    const activeClassQuery = getClass(classId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeClassQuery),
      context.queryClient.ensureQueryData(getClassDraft(classId, client))
    ])
    const routeSubject = getAuthoredRouteSubject(classId, response, draft)
    const system = await loadAuthoredRouteSystem(
      context.queryClient,
      client,
      response?.item?.systemId ?? draft?.systemId
    )
    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.classPublicId, params.classSlug, routeSubject)
    ) {
      throw redirect({
        params: buildClassRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true,
        to: '/classes/$classPublicId/$classSlug/edit'
      })
    }

    return createAuthoredFormRouteLoaderData({
      breadcrumbLabel: routeSubject?.label,
      draft,
      response,
      subjectId: classId,
      system
    })
  },
  component: AuthoringLayout
})
