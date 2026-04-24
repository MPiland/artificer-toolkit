import { createFileRoute } from '@tanstack/react-router'
import { UpdatePasswordPage } from '#app/auth/pages'

export const Route = createFileRoute('/_guest/_auth/update-password')({
  component: UpdatePasswordPage
})
