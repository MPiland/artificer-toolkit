import { createFileRoute } from '@tanstack/react-router'
import Feats from '../../pages/feats/Feats'

export const Route = createFileRoute('/feats/')({
  component: Feats,
})
