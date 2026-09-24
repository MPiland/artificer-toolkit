import { createFileRoute, redirect } from '@tanstack/react-router'
import { classResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getClass, useGetClass } from '#app/data/classes/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import {
  resolveAuthoredDetailView,
  validateAuthoredDetailSearch
} from '#app/routing/authoredDetailSearch'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'
import type { ClassDetailLoaderData } from '#app/routes/-routeLoaderData'
import { ClassDetailPage } from '#domains/classes/pages/ClassDetailPage'

const classDetailMeta = ['classes', 'currencies', 'equipment', 'languages', 'skills']

export const Route = createFileRoute('/_authed/classes/$classPublicId/$classSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, location, params }): Promise<ClassDetailLoaderData> => {
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = classResponseDtoSchema.parse(
      await context.queryClient.ensureQueryData(
        getClass({ id: params.classPublicId, meta: classDetailMeta, view })
      )
    )
    const draft = response?.draft ?? null
    const classId = response?.item?.id ?? draft?.subjectId ?? params.classPublicId
    const references = {
      classes: response?.meta?.classes ?? [],
      currencies: response?.meta?.currencies ?? [],
      equipment: response?.meta?.equipment ?? [],
      languages: response?.meta?.languages ?? [],
      skills: response?.meta?.skills ?? []
    }
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
  const { classId, view } = Route.useLoaderData()
  const { classPublicId } = Route.useParams()
  const { data: response } = useGetClass({ id: classPublicId, meta: classDetailMeta, view })

  return (
    <ClassDetailPage
      classId={classId}
      draft={response?.draft ?? null}
      references={{
        currencies: response?.meta?.currencies ?? [],
        equipment: response?.meta?.equipment ?? [],
        languages: response?.meta?.languages ?? [],
        skills: response?.meta?.skills ?? []
      }}
      response={response}
      view={view}
    />
  )
}
