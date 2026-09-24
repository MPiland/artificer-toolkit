import { createFileRoute } from '@tanstack/react-router'
import { CharacterListPage } from '#domains/characters'

export const Route = createFileRoute('/_authed/characters/')({
  component: CharacterListPage
})
