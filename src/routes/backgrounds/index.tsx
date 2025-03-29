import { createFileRoute } from '@tanstack/react-router'
import Backgrounds from '../../pages/backgrounds/Backgrounds'

export const Route = createFileRoute('/backgrounds/')({
  component: Backgrounds,
})
