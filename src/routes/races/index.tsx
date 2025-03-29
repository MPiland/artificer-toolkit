import { createFileRoute } from '@tanstack/react-router'
import Races from '../../pages/races/Races'

export const Route = createFileRoute('/races/')({
  component: Races,
})
