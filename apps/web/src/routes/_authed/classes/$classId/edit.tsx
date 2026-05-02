import { createFileRoute } from '@tanstack/react-router'
import { getClass, getClassDraft } from '#app/data/classes/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { ClassEditPage } from '#domains/classes'

export const Route = createFileRoute('/_authed/classes/$classId/edit')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    const activeClassQuery = getClass(params.classId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeClassQuery),
      context.queryClient.ensureQueryData(getClassDraft(params.classId, client))
    ])

    return {
      draft,
      response
    }
  },
  component: () => <ClassEditPage />
})
