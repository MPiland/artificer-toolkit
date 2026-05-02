import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/feats/$featId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/feats/$featId/edit',
      params: { featId: params.featId }
    })
  }
})
