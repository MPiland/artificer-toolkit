import { createFileRoute } from '@tanstack/react-router'
import Home from '../../../domains/home/Home'

export const Route = createFileRoute('/_authed/home/')({
  component: Home,
})
