import type { AuthoredRecordStatus } from '#core'
import type { CharacterProfileAuthored } from './profile.js'
import type { CharacterIntent } from './intent.js'
import type { CharacterState } from './state.js'

export interface CharacterAuthored {
  id: string
  label: string
  description?: string
  status?: AuthoredRecordStatus
  profile: CharacterProfileAuthored

  intent: CharacterIntent
  state: CharacterState

  systemId: string
  primaryRulesCatalogueId: string
  userId: string
}
