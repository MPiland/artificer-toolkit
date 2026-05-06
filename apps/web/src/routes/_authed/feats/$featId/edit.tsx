import { createFileRoute } from '@tanstack/react-router'
import { FeatEditPage } from '#domains/feats'

export const Route = createFileRoute('/_authed/feats/$featId/edit')({
  component: FeatEditPage
})
