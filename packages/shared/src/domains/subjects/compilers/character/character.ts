import type { CharacterAuthored } from '#authored'
import { compileCharacterIntent, type CompiledCharacterIntent } from './intent.js'
import { compileCharacterState, type CompiledCharacterState } from './state.js'

export type CompiledCharacter = {
  id: string
  label: string
  description?: string

  intent: CompiledCharacterIntent
  state: CompiledCharacterState

  systemId: string
  userId: string
}

export function compileCharacter(authored: CharacterAuthored): CompiledCharacter {
  return {
    id: authored.id,
    label: authored.label,
    description: authored.description,

    intent: compileCharacterIntent(authored.intent),
    state: compileCharacterState(authored.state),

    systemId: authored.systemId,
    userId: authored.userId
  }
}
