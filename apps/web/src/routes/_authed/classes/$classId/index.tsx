import { createFileRoute } from '@tanstack/react-router'
import { getClass, getClassDraft } from '#app/data/classes/queries'
import { getAuthoredContentReferenceData } from '#app/data/contentReferences'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { ClassDetailPage } from '#domains/classes/pages/ClassDetailPage'

export const Route = createFileRoute('/_authed/classes/$classId/')({
  loader: async ({ context, params }) => {
    const client = createServerApi()
    const activeClassQuery = getClass(params.classId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeClassQuery),
      context.queryClient.ensureQueryData(getClassDraft(params.classId, client))
    ])
    const references = await context.queryClient.ensureQueryData(
      getAuthoredContentReferenceData(response?.item.systemId ?? draft?.systemId, client)
    )

    return { draft, references, response }
  },
  component: ClassDetailRoute
})

function ClassDetailRoute() {
  const { draft, references, response } = Route.useLoaderData()
  const { classId } = Route.useParams()

  return <ClassDetailPage classId={classId} draft={draft} references={references} response={response} />
}
