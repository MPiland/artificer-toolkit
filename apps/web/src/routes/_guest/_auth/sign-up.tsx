import { createFileRoute } from '@tanstack/react-router'
import { SignUpPage } from '#app/auth/pages'

export const Route = createFileRoute('/_guest/_auth/sign-up')({
  component: SignUpPage
})
