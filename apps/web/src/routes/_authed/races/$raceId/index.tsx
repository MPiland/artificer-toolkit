import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/races/$raceId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/races/$raceId/edit',
      params: { raceId: params.raceId }
    })
  }
})
