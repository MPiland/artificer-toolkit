import { createFileRoute } from '@tanstack/react-router'
import { getSpellReferenceData } from '#app/data/spells/referenceData'
import { createServerApi } from '#app/lib/api'
import { SpellCreatePage } from '#domains/spells'

export const Route = createFileRoute('/_authed/spells/new')({
  loader: ({ context }) => context.queryClient.ensureQueryData(
    getSpellReferenceData(createServerApi(context.accessToken))
  ),
  component: NewSpellRoute
})

function NewSpellRoute() {
  const { user } = Route.useRouteContext()

  return <SpellCreatePage userId={user?.id ?? 'unknown-user'} />
}
