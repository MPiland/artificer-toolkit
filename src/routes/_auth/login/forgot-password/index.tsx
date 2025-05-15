import { createFileRoute } from '@tanstack/react-router'
import ForgotPassword from '@/pages/auth/ForgotPassword'

export const Route = createFileRoute('/_auth/login/forgot-password/')({
  component: ForgotPassword,
})
