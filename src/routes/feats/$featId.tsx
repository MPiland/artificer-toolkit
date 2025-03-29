import { createFileRoute } from '@tanstack/react-router'
import Feat from '../../pages/feats/Feat'

export const Route = createFileRoute('/feats/$featId')({
  component: Feat,
})
