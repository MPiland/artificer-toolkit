import { createFileRoute } from '@tanstack/react-router'
import Race from '../../pages/races/Race'

export const Route = createFileRoute('/races/$raceId')({
  component: Race,
})
