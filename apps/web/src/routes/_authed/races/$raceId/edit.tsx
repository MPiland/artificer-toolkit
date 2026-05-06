import { createFileRoute } from '@tanstack/react-router'
import { RaceEditPage } from '#domains/races'

export const Route = createFileRoute('/_authed/races/$raceId/edit')({
  component: RaceEditPage
})
