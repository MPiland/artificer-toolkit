import { createFileRoute } from '@tanstack/react-router'
import { VerifyPasswordResetPage } from '#app/auth/pages'

export const Route = createFileRoute('/_guest/_auth/verify-password-reset')({
  component: VerifyPasswordResetPage
})
