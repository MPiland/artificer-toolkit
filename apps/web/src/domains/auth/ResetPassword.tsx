import { Auth, type AuthStatus } from './Auth'

export function ResetPassword({
  status,
  onSubmit,
}: {
  status: AuthStatus
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}) {
  return <Auth mode='reset-confirm' status={status} onSubmit={onSubmit} />
}
