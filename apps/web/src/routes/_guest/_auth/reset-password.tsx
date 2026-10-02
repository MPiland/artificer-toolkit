import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordPage } from '#app/auth/pages'

export const Route = createFileRoute('/_guest/_auth/reset-password')({
  ssr: true,
  component: ResetPasswordPage
})
