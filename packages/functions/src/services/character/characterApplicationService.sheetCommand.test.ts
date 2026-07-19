import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import type {
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characters'

const mocks = vi.hoisted(() => ({
  ensureRouteIdentity: vi.fn(),
  executeCharacterSheetCommand: vi.fn(),
  findBuilderDraft: vi.fn(),
  resolveByPublicIdForUser: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createAuthoredRouteIdRepository: () => ({
      ensure: mocks.ensureRouteIdentity,
      resolveByPublicIdForUser: mocks.resolveByPublicIdForUser
    }),
    createCharacterBuilderDraftRepository: () => ({
      findByCharacter: mocks.findBuilderDraft
    })
  }
})

vi.mock('./sheetService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sheetService.js')>()
  return {
    ...actual,
    executeCharacterSheetCommand: mocks.executeCharacterSheetCommand
  }
})

const { dispatchCommandForUser } = await import('./characterApplicationService.js')

const command = {
  type: 'SET_INSPIRATION',
  inspired: true,
  expectedVersion: 2,
  commandId: '00000000-0000-4000-8000-000000000003'
} satisfies CharacterSheetCommandInputDto

describe('dispatchCommandForUser', () => {
  beforeEach(() => {
    mocks.ensureRouteIdentity.mockReset()
    mocks.executeCharacterSheetCommand.mockReset()
    mocks.findBuilderDraft.mockReset()
    mocks.resolveByPublicIdForUser.mockReset()
    mocks.ensureRouteIdentity.mockResolvedValue({ publicId: 'aria-sheet' })
    mocks.findBuilderDraft.mockResolvedValue(null)
    mocks.executeCharacterSheetCommand.mockResolvedValue({
      characterId: '00000000-0000-4000-8000-000000000001',
      sheet: {
        meta: {
          characterId: '00000000-0000-4000-8000-000000000001',
          systemId: 'system-1',
          status: 'ACTIVE',
          streamVersion: 3
        }
      }
    } as CharacterSheetCommandResponseDto)
  })

  it('resolves public character handles before executing a Sheet command', async () => {
    const canonicalCharacterId = '00000000-0000-4000-8000-000000000001'
    mocks.resolveByPublicIdForUser.mockResolvedValue({
      subjectId: canonicalCharacterId
    })
    const db = {} as DBLike

    const result = await dispatchCommandForUser(db, 'aria-sheet', command, 'user-1')

    expect(mocks.resolveByPublicIdForUser).toHaveBeenCalledWith({
      subjectKind: 'CHARACTER',
      publicId: 'aria-sheet'
    })
    expect(mocks.executeCharacterSheetCommand).toHaveBeenCalledWith({
      db,
      characterId: canonicalCharacterId,
      command,
      userId: 'user-1'
    })
    expect(result.sheet).toMatchObject({
      publicId: 'aria-sheet',
      meta: { hasBuilderDraft: false }
    })
  })

  it('rejects unknown public character handles without executing a command', async () => {
    mocks.resolveByPublicIdForUser.mockResolvedValue(null)

    await expect(
      dispatchCommandForUser({} as DBLike, 'missing-sheet', command, 'user-1')
    ).rejects.toMatchObject({ name: 'NotFoundError' })
    expect(mocks.executeCharacterSheetCommand).not.toHaveBeenCalled()
  })
})
