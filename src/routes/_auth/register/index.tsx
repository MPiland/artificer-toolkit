import AuthForm from '@/pages/auth/AuthForm'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/register/')({
  component: AuthForm,
})