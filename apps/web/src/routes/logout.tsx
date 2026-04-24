import { createFileRoute } from '@tanstack/react-router'
import { SignOutPage } from '#app/auth/pages'

export const Route = createFileRoute('/logout')({
  component: SignOutPage
})
