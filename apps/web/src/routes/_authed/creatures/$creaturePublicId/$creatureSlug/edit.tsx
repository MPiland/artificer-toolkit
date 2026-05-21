import { createFileRoute } from '@tanstack/react-router'
import { CreatureEditPage } from '#domains/creatures'

export const Route = createFileRoute('/_authed/creatures/$creaturePublicId/$creatureSlug/edit')({
  component: CreatureEditPage
})
