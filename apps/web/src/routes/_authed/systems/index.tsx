import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/systems/')({
  loader: () => {
    throw redirect({
      replace: true,
      to: '/home'
    })
  }
})
