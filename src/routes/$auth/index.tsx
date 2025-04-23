import { createFileRoute } from '@tanstack/react-router'
import Auth from '@/pages/auth/Auth'

export const Route = createFileRoute('/$auth/')({
  component: Auth,
})
