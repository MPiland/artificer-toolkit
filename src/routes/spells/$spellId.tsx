import { createFileRoute } from '@tanstack/react-router'
import Spell from '../../pages/spells/Spell'

export const Route = createFileRoute('/spells/$spellId')({
  component: Spell,
})
