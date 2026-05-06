import { createFileRoute } from '@tanstack/react-router'
import { CreatureEditPage } from '#domains/creatures'

export const Route = createFileRoute('/_authed/creatures/$creatureId/edit')({
  component: CreatureEditPage
})
