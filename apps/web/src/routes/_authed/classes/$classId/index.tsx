import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/classes/$classId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/classes/$classId/edit',
      params: { classId: params.classId }
    })
  }
})
