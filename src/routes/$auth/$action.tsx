import { createFileRoute } from '@tanstack/react-router'
import Confirm from '@/pages/auth/Confirm'

export const Route = createFileRoute('/$auth/$action')({
  component: Confirm,
})
