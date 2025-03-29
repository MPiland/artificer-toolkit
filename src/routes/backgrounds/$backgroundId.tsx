import { createFileRoute } from '@tanstack/react-router'
import Background from '../../pages/backgrounds/Background'

export const Route = createFileRoute('/backgrounds/$backgroundId')({
  component: Background,
})
