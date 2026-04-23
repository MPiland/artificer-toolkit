import { createFileRoute } from '@tanstack/react-router'
import { AuthConfirmed } from '#auth'

export const Route = createFileRoute('/auth/confirmed')({
  component: AuthConfirmed,
})
