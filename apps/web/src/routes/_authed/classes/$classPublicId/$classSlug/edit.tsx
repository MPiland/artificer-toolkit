import { createFileRoute, redirect } from '@tanstack/react-router'
import { classResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getClass } from '#app/data/classes/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
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
    const [active, working] = await Promise.all([
      context.queryClient.ensureQueryData(getClass(params.classPublicId)),
      context.queryClient.ensureQueryData(getClass({ id: params.classPublicId, view: 'draft' }))
    ])
    const response = classResponseDtoSchema.parse(active)
    const draft = classResponseDtoSchema.parse(working)?.draft ?? null
    const classId = response?.item?.id ?? draft?.subjectId ?? params.classPublicId
    const routeSubject = getAuthoredRouteSubject(classId, response, draft)
    const system = await loadAuthoredRouteSystem(
      context.queryClient,
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
