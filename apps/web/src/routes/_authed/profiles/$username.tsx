import { createFileRoute } from '@tanstack/react-router'
import { PublicProfilePage } from '#app/profiles/PublicProfilePage'

export const Route = createFileRoute('/_authed/profiles/$username')({
  component: PublicProfileRoute
})

function PublicProfileRoute() {
  const { username } = Route.useParams()
  return <PublicProfilePage username={username} />
}
