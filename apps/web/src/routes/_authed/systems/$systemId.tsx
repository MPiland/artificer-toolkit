import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/systems/$systemId')({
  loader: () => {
    throw redirect({
      replace: true,
      to: '/home'
    })
  }
})
