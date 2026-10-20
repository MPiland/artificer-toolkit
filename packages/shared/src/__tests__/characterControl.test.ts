import { describe, expect, it } from 'vitest'
import {
  controlsAssignedCharacter,
  controlsUnboundSceneToken,
  withCharacterControllers
} from '../domains/campaign/characterControl.js'

const owner = '00000000-0000-4000-8000-000000000001'
const grantee = '00000000-0000-4000-8000-000000000002'
const stranger = '00000000-0000-4000-8000-000000000003'
const characterId = '00000000-0000-4000-8000-000000000011'
const otherCharacterId = '00000000-0000-4000-8000-000000000012'
const assignments = [
  { characterId, userId: owner, controllerUserIds: [grantee] },
  { characterId: otherCharacterId, userId: owner }
]

describe('controlsAssignedCharacter', () => {
  it('admits the assigned player and a granted member, and nobody else', () => {
    expect(controlsAssignedCharacter(assignments[0], owner)).toBe(true)
    expect(controlsAssignedCharacter(assignments[0], grantee)).toBe(true)
    expect(controlsAssignedCharacter(assignments[0], stranger)).toBe(false)
    expect(controlsAssignedCharacter(assignments[1], grantee)).toBe(false)
    expect(controlsAssignedCharacter(null, owner)).toBe(false)
    expect(controlsAssignedCharacter(undefined, owner)).toBe(false)
  })
})

describe('controlsUnboundSceneToken', () => {
  const token = (overrides: { characterId?: string; controlledByUserIds?: string[] }) => ({
    controlledByUserIds: [],
    ...overrides
  })

  it('follows the token Character, so a grant reaches only that Character token', () => {
    expect(controlsUnboundSceneToken(token({ characterId }), grantee, assignments)).toBe(true)
    expect(
      controlsUnboundSceneToken(token({ characterId: otherCharacterId }), grantee, assignments)
    ).toBe(false)
  })

  it('does not hand an owner every unbound token, only the ones for their Characters', () => {
    expect(controlsUnboundSceneToken(token({}), owner, assignments)).toBe(false)
    expect(controlsUnboundSceneToken(token({ characterId }), owner, assignments)).toBe(true)
    expect(
      controlsUnboundSceneToken(token({ characterId: crypto.randomUUID() }), owner, assignments)
    ).toBe(false)
  })

  it('keeps the GM-set token controllers', () => {
    expect(
      controlsUnboundSceneToken(token({ controlledByUserIds: [stranger] }), stranger, [])
    ).toBe(true)
    expect(controlsUnboundSceneToken(token({}), stranger, assignments)).toBe(false)
  })
})

describe('withCharacterControllers', () => {
  const token = (
    id: string,
    overrides: { characterId?: string; controlledByUserIds?: string[] }
  ) => ({
    controlledByUserIds: [] as string[],
    id,
    ...overrides
  })

  it('lists a Character player and grantees on its linked tokens beside the GM list', () => {
    const scene = { tokens: [token('hero', { characterId, controlledByUserIds: [stranger] })] }
    expect(withCharacterControllers(scene, assignments).tokens[0]?.controlledByUserIds).toEqual([
      stranger,
      owner,
      grantee
    ])
  })

  it('leaves unlinked tokens, other Characters and the stored Scene alone', () => {
    const scene = {
      tokens: [
        token('npc', {}),
        token('other', { characterId: otherCharacterId }),
        token('unassigned', { characterId: crypto.randomUUID() })
      ]
    }
    const derived = withCharacterControllers(scene, assignments)
    expect(derived.tokens.map((entry) => entry.controlledByUserIds)).toEqual([[], [owner], []])
    expect(scene.tokens.map((entry) => entry.controlledByUserIds)).toEqual([[], [], []])
  })

  it('returns the same Scene when no token is linked to a Character', () => {
    const scene = { tokens: [token('npc', {})] }
    expect(withCharacterControllers(scene, assignments)).toBe(scene)
  })

  it('stops listing a grantee once the grant is revoked', () => {
    const scene = { tokens: [token('hero', { characterId })] }
    const revoked = withCharacterControllers(scene, [{ characterId, userId: owner }])
    expect(revoked.tokens[0]?.controlledByUserIds).toEqual([owner])
  })
})
