import { createFileRoute } from '@tanstack/react-router'
import Character from '../../pages/characters/Character'

export const Route = createFileRoute('/characters/$characterId')({
  component: Character,
})
