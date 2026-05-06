import { createFileRoute } from '@tanstack/react-router'
import { SpellEditPage } from '#domains/spells'

export const Route = createFileRoute('/_authed/spells/$spellId/edit')({
  component: () => <SpellEditPage />
})
