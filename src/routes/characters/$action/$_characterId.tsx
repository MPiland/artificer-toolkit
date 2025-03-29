import { createFileRoute } from '@tanstack/react-router'
import CharacterForm from '../../../pages/characters/CharacterForm'

export const Route = createFileRoute('/characters/$action/$_characterId')({
  component: CharacterForm,
})
