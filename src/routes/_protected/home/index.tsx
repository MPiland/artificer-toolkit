import { createFileRoute } from '@tanstack/react-router'
import Home from '~/pages/home/Home'

export const Route = createFileRoute('/_protected/home/')({
  component: Home,
})
