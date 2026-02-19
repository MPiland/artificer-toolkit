import type { CharacterIntent } from './intent.js'
import type { CharacterState } from './state.js'

export interface CharacterAuthored {
  id: string
  label: string
  description?: string

  intent: CharacterIntent
  state: CharacterState

  systemId: string
  userId: string
}
