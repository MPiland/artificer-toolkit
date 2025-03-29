import { createFileRoute } from '@tanstack/react-router'
import RaceForm from '../../../pages/races/RaceForm'

export const Route = createFileRoute('/races/$action/$_raceId')({
  component: RaceForm,
})
