import { createFileRoute } from '@tanstack/react-router'
import Landing from '~/pages/landing/Landing'

export const Route = createFileRoute('/')({
  component: Landing,
})
