import { createFileRoute } from '@tanstack/react-router'
import { RaceCataloguePage } from '#domains/races/pages/RaceCataloguePage'

export const Route = createFileRoute('/_authed/races/')({
  component: RaceCataloguePage
})
