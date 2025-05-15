import { createFileRoute } from '@tanstack/react-router'
import Confirm from '@/pages/auth/Confirm'

export const Route = createFileRoute('/_auth/register/confirm')({
  validateSearch: ({ email }: { email: string }) => ({
    email: email ?? '',
  }),
  component: Confirm,
})
