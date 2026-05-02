import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/spells/$spellId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/spells/$spellId/edit',
      params: { spellId: params.spellId }
    })
  }
})
