import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '#app/home'

export const Route = createFileRoute('/_authed/home/')({
  component: HomePage
})
