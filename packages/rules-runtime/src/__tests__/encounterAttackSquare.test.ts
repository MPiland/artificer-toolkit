import { describe, expect, it } from 'vitest'
import {
  resolveEncounterActionInputDtoSchema,
  type ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  attackSquareCandidates,
  attackSquareChildCommand,
  attackSquareChildCommandId
} from '../encounterAttackSquare.js'

const id = (suffix: number) => `00000000-0000-4000-8000-${suffix.toString(16).padStart(12, '0')}`
const token = (tokenId: string, actorId: string, x: number, y = 0) => ({
  tokenId,
  actorId,
  position: { x, y },
  width: 1,
  height: 1,
  rotationDegrees: 0
})

const attacker = id(1)
const goblin = id(2)
const hiddenOgre = id(3)

describe('attackSquareCandidates', () => {
  it('names every creature standing on the square, hidden ones included, never the attacker', () => {
    const tokens = [
      token(id(0x21), attacker, 0),
      token(id(0x23), hiddenOgre, 5),
      token(id(0x22), goblin, 5),
      token(id(0x24), id(4), 9)
    ]
    expect(
      attackSquareCandidates({
        point: { x: 5, y: 0 },
        attackerActorId: attacker,
        defeatedActorIds: new Set(),
        tokens
      })
    ).toEqual([
      { actorId: goblin, tokenId: id(0x22) },
      { actorId: hiddenOgre, tokenId: id(0x23) }
    ])
    expect(
      attackSquareCandidates({
        point: { x: 0, y: 0 },
        attackerActorId: attacker,
        defeatedActorIds: new Set(),
        tokens
      })
    ).toEqual([])
  })

  it('names a creature once when it has several tokens on the square', () => {
    const tokens = [token(id(0x32), goblin, 5), token(id(0x31), goblin, 5)]
    expect(
      attackSquareCandidates({
        point: { x: 5, y: 0 },
        attackerActorId: attacker,
        defeatedActorIds: new Set(),
        tokens
      })
    ).toEqual([{ actorId: goblin, tokenId: id(0x31) }])
  })

  it('skips a defeated creature', () => {
    const tokens = [token(id(0x21), goblin, 5), token(id(0x23), hiddenOgre, 5)]
    expect(
      attackSquareCandidates({
        point: { x: 5, y: 0 },
        attackerActorId: attacker,
        defeatedActorIds: new Set([goblin]),
        tokens
      })
    ).toEqual([{ actorId: hiddenOgre, tokenId: id(0x23) }])
  })

  it('finds nothing on an empty square', () => {
    expect(
      attackSquareCandidates({
        point: { x: 40, y: 40 },
        attackerActorId: attacker,
        defeatedActorIds: new Set(),
        tokens: [token(id(0x21), goblin, 5)]
      })
    ).toEqual([])
  })
})

describe('attackSquareChildCommand', () => {
  const occurrenceId = id(0x90)
  const command: ResolveEncounterActionInputDto = resolveEncounterActionInputDtoSchema.parse({
    type: 'RESOLVE_ACTION',
    encounterId: id(0x91),
    commandId: id(0x92),
    expectedVersion: 7,
    actorId: attacker,
    actionId: 'attack:longsword',
    target: { kind: 'SQUARE', sceneId: id(0x93), expectedSceneVersion: 4, point: { x: 5, y: 0 } }
  })
  const context = {
    scene: { sceneId: id(0x93), sceneVersion: 4 },
    sourceTokenId: id(0x21),
    candidates: [
      { actorId: goblin, tokenId: id(0x22) },
      { actorId: hiddenOgre, tokenId: id(0x23) }
    ]
  }

  it('is the same attack aimed at the creature the GM named, under a derived command id', () => {
    const child = attackSquareChildCommand({
      command,
      context,
      occurrenceId,
      occupantActorId: hiddenOgre,
      expectedVersion: 7
    })
    expect(child).toEqual({
      ...command,
      commandId: attackSquareChildCommandId(occurrenceId),
      target: { kind: 'ACTOR', actorId: hiddenOgre },
      sceneContext: {
        sceneId: id(0x93),
        expectedSceneVersion: 4,
        sourceTokenId: id(0x21),
        targetTokenId: id(0x23)
      }
    })
    expect(child.commandId).not.toBe(command.commandId)
    expect(resolveEncounterActionInputDtoSchema.safeParse(child).success).toBe(true)
  })

  it('derives one stable command id per occurrence', () => {
    expect(attackSquareChildCommandId(occurrenceId)).toBe(attackSquareChildCommandId(occurrenceId))
    expect(attackSquareChildCommandId(occurrenceId)).not.toBe(attackSquareChildCommandId(id(0x94)))
  })

  it('refuses a creature that is not a candidate', () => {
    expect(() =>
      attackSquareChildCommand({
        command,
        context,
        occurrenceId,
        occupantActorId: id(0x99),
        expectedVersion: 7
      })
    ).toThrow('does not stand on the square')
  })
})
