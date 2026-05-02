import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/backgrounds/$backgroundId/edit',
      params: { backgroundId: params.backgroundId }
    })
  }
})
