import { createFileRoute } from '@tanstack/react-router'
import Confirm from '~/pages/auth/Confirm'

export const Route = createFileRoute('/_auth/confirm')({
  validateSearch: ({ email }: { email: string }) => ({
    email: email ?? '',
  }),
  component: Confirm,
})
