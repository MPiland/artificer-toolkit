import { describe, expect, it } from 'vitest'
import { buildCharacterHistoryView } from '../domains/character/historyView.js'

describe('character history view', () => {
  it('uses the requested character id when there are no events yet', () => {
    expect(buildCharacterHistoryView([], 'character-1')).toEqual({
      characterId: 'character-1',
      entries: []
    })
  })
})
