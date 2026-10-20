import { beforeEach, describe, expect, it } from 'vitest'
import { readSavedChatMode } from './campaignChat.utils'

describe('readSavedChatMode', () => {
  beforeEach(() => window.localStorage.clear())

  it('returns the saved out-of-character voice with or without a Character', () => {
    window.localStorage.setItem('chat-mode', 'OOC')

    expect(readSavedChatMode('chat-mode', false)).toBe('OOC')
    expect(readSavedChatMode('chat-mode', true)).toBe('OOC')
  })

  it('returns the roleplay voice only while a Character is assigned', () => {
    window.localStorage.setItem('chat-mode', 'ROLEPLAY')

    expect(readSavedChatMode('chat-mode', true)).toBe('ROLEPLAY')
    expect(readSavedChatMode('chat-mode', false)).toBeNull()
  })

  it('returns null when nothing valid is saved', () => {
    expect(readSavedChatMode('chat-mode', true)).toBeNull()
    window.localStorage.setItem('chat-mode', 'other')
    expect(readSavedChatMode('chat-mode', true)).toBeNull()
  })
})
