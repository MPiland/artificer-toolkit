import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/creatures/$creatureId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/creatures/$creatureId/edit',
      params: { creatureId: params.creatureId }
    })
  }
})
