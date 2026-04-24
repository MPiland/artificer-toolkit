import { createFileRoute } from '@tanstack/react-router'
import { SignInPage } from '#app/auth/pages'

export const Route = createFileRoute('/_guest/_auth/sign-in')({
  component: SignInPage
})
