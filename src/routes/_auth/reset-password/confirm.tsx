import { createFileRoute } from '@tanstack/react-router'
import Confirm from '~/pages/auth/Confirm'

export const Route = createFileRoute('/_auth/reset-password/confirm')({
  validateSearch: ({ email }: { email: string }) => ({
    email: email ?? '',
  }),
  onError: ({error}) => {
    console.log({ error })
  },
  component: Confirm,
})
