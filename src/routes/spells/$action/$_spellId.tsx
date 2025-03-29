import { createFileRoute } from '@tanstack/react-router'
import SpellForm from '../../../pages/spells/SpellForm'

export const Route = createFileRoute('/spells/$action/$_spellId')({
  component: SpellForm,
})
