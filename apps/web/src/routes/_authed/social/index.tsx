import { createFileRoute } from '@tanstack/react-router'
import { SocialHubPage } from '#domains/social/SocialHubPage'
import { socialHubSearchSchema } from '#domains/social/socialSearch'

export const Route = createFileRoute('/_authed/social/')({
  validateSearch: socialHubSearchSchema,
  component: SocialHubRoute
})

function SocialHubRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <SocialHubPage
      search={search}
      onSearchChange={(next) => void navigate({ replace: true, search: next })}
    />
  )
}
