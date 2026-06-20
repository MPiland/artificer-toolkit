import { createFileRoute, redirect } from '@tanstack/react-router'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { getAuthoredContentReferenceData } from '#app/data/contentReferences'
import { getClass } from '#app/data/classes/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'
import { validateAuthoredDetailSearch } from '#app/routing/authoredDetailSearch'
import type { ClassDetailLoaderData } from '#app/routes/-routeLoaderData'
import { ClassDetailPage } from '#domains/classes/pages/ClassDetailPage'

const classDetailMeta = ['classes']

export const Route = createFileRoute('/_authed/classes/$classPublicId/$classSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, params }): Promise<ClassDetailLoaderData> => {
    const client = createServerApi()
    const classId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.classes.list(),
      publicId: params.classPublicId,
      queryClient: context.queryClient,
      subjectKind: 'CLASS'
    })
    const view = search.view ?? 'active'
    const response = await ensureOptionalActiveContent(
      context.queryClient,
      getClass(
        {
          id: classId,
          includeDraft: true,
          meta: classDetailMeta,
          view
        },
        client
      )
    )
    const draft = response?.draft ?? null
    const references: Pick<
      AuthoredContentReferenceData,
      'classes' | 'currencies' | 'equipment' | 'languages' | 'skills'
    > = response?.item
      ? await context.queryClient.ensureQueryData(
          getAuthoredContentReferenceData(response.item.systemId, client)
        )
      : { classes: [], currencies: [], equipment: [], languages: [], skills: [] }
    const routeSubject = getAuthoredRouteSubject(classId, response, draft)
    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.classPublicId, params.classSlug, routeSubject)
    ) {
      throw redirect({
        params: buildClassRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true,
        to: '/classes/$classPublicId/$classSlug'
      })
    }

    return { breadcrumbLabel: routeSubject?.label, classId, draft, references, response, view }
  },
  component: ClassDetailRoute
})

function ClassDetailRoute() {
  const { classId, draft, references, response, view } = Route.useLoaderData()

  return (
    <ClassDetailPage
      classId={classId}
      draft={draft}
      references={references}
      response={response}
      view={view}
    />
  )
}
