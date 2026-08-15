import { createFileRoute, redirect } from '@tanstack/react-router'
import { RuleStudioPage } from '#app/domains/rules/RuleStudioPage'

export const Route = createFileRoute('/_authed/admin/rules')({
  ssr: 'data-only',
  beforeLoad: ({ context }) => {
    if (!context.isSuperAdmin) throw redirect({ to: '/home' })
  },
  component: RuleStudioPage
})
