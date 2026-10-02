import { createFileRoute } from '@tanstack/react-router'
import { SignOutPage } from '#app/auth/pages'

export const Route = createFileRoute('/logout')({
  ssr: true,
  component: SignOutPage
})
