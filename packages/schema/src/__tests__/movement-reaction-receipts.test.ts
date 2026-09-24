import { describe, expect, it } from 'vitest'
import { pendingSpatialCharacterTransitionsDtoSchema } from '../shared/ruleExecutionMovementReactionReceipts.js'

const firstCharacterId = '00000000-0000-4000-8000-000000000001'
const secondCharacterId = '00000000-0000-4000-8000-000000000002'
const thirdCharacterId = '00000000-0000-4000-8000-000000000003'

describe('pending spatial Character transitions', () => {
  it('coalesces each Character command transition in canonical order', () => {
    expect(
      pendingSpatialCharacterTransitionsDtoSchema.parse([
        { characterId: firstCharacterId, beforeStreamVersion: 3, afterStreamVersion: 5 },
        { characterId: secondCharacterId, beforeStreamVersion: 7, afterStreamVersion: 8 },
        { characterId: thirdCharacterId, beforeStreamVersion: 1, afterStreamVersion: 2 }
      ])
    ).toHaveLength(3)
  })

  it.each(
    [
      [
        { characterId: firstCharacterId, beforeStreamVersion: 3, afterStreamVersion: 5 },
        { characterId: firstCharacterId, beforeStreamVersion: 5, afterStreamVersion: 6 }
      ],
      [
        { characterId: secondCharacterId, beforeStreamVersion: 3, afterStreamVersion: 4 },
        { characterId: firstCharacterId, beforeStreamVersion: 4, afterStreamVersion: 5 }
      ],
      [{ characterId: firstCharacterId, beforeStreamVersion: 3, afterStreamVersion: 3 }],
      [{ characterId: firstCharacterId, beforeStreamVersion: 4, afterStreamVersion: 3 }]
    ].map((transitions) => ({ transitions }))
  )('rejects malformed command transitions', ({ transitions }) => {
    expect(() => pendingSpatialCharacterTransitionsDtoSchema.parse(transitions)).toThrow()
  })
})
