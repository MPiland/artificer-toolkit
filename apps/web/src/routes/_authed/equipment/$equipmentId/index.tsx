import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/equipment/$equipmentId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/equipment/$equipmentId/edit',
      params: { equipmentId: params.equipmentId }
    })
  }
})
