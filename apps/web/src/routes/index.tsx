import { createFileRoute } from '@tanstack/react-router'
import Landing from '../domains/landing/Landing'

export const Route = createFileRoute('/')({
  component: Landing
})
