import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/vehicles/$vehicleId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/vehicles/$vehicleId/edit',
      params: { vehicleId: params.vehicleId }
    })
  }
})
