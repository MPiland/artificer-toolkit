import { createFileRoute } from '@tanstack/react-router'
import { AuthConfirmedPage } from '#app/auth/pages'

export const Route = createFileRoute('/_guest/_auth/auth/confirmed')({
  component: AuthConfirmedPage
})
