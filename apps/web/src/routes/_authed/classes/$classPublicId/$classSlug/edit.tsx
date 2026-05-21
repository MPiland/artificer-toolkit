import { createFileRoute, redirect } from '@tanstack/react-router'
import { getClass, getClassDraft } from '#app/data/classes/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle,
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'
import { ClassEditPage } from '#domains/classes'

export const Route = createFileRoute('/_authed/classes/$classPublicId/$classSlug/edit')({
  loader: async ({ context, params }) => {
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
    if (routeSubject && !isCanonicalAuthoredRouteHandle(params.classPublicId, params.classSlug, routeSubject)) {
      throw redirect({
        params: buildClassRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true,
        to: '/classes/$classPublicId/$classSlug/edit'
      })
    }

    return {
      breadcrumbLabel: routeSubject?.label,
      classId,
      draft,
      response
    }
  },
  component: () => <ClassEditPage />
})
