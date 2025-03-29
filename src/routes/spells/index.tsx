import { createFileRoute } from '@tanstack/react-router'
import Spells from '../../pages/spells/Spells'

export const Route = createFileRoute('/spells/')({
  component: Spells,
})
