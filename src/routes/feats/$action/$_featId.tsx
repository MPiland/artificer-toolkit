import { createFileRoute } from '@tanstack/react-router'
import FeatForm from '../../../pages/feats/FeatForm'

export const Route = createFileRoute('/feats/$action/$_featId')({
  component: FeatForm,
})
