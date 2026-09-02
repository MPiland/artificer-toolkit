import type { DBLike } from '@artificer-toolkit/db'
import { describe, expect, it, vi } from 'vitest'
import type { TrpcContext } from './dbContext.js'
import { authenticatedContext } from './routerTestFixtures.js'

const getCharacterPreparationOptionsForUser = vi.hoisted(() =>
  vi.fn(async () => ({
    characterId: '00000000-0000-0000-0000-000000000001',
    streamVersion: 3,
    classes: [
      {
        classId: '00000000-0000-0000-0000-000000000002',
        label: 'Cleric',
        preparedSpellLimit: 2,
        options: [
          {
            spellId: '00000000-0000-0000-0000-000000000003',
            label: 'Healing Word',
            level: 1,
            prepared: false,
            committed: false
          }
        ]
      }
    ]
  }))
)
const getCharacterSheetActionsForUser = vi.hoisted(() =>
  vi.fn(async () => [
    {
      id: 'action-1',
      label: 'Strike',
      kind: 'ACTION' as const,
      rollable: true,
      availability: { status: 'AVAILABLE' as const }
    }
  ])
)

vi.mock('@artificer-toolkit/functions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/functions')>()),
  getCharacterPreparationOptionsForUser,
  getCharacterSheetActionsForUser
}))

vi.mock('./dbContext.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dbContext.js')>()
  return {
    ...actual,
    withAuthenticatedDb: async <TResult>(
      context: TrpcContext,
      callback: (db: DBLike, userId: string) => Promise<TResult>
    ) => await callback({} as DBLike, actual.requireUserId(context))
  }
})

import { appRouter } from './router.js'

describe('tRPC Character router', () => {
  it('returns only the authenticated viewer action choices', async () => {
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(
      caller.characters.actions({ id: '00000000-0000-0000-0000-000000000001' })
    ).resolves.toEqual([expect.objectContaining({ id: 'action-1', label: 'Strike' })])
    expect(getCharacterSheetActionsForUser).toHaveBeenCalledWith(
      {},
      '00000000-0000-0000-0000-000000000001',
      'user-1'
    )
  })

  it('loads preparation options for the authenticated Character viewer', async () => {
    const caller = appRouter.createCaller(authenticatedContext)

    await expect(
      caller.characters.preparationOptions({ id: '00000000-0000-0000-0000-000000000001' })
    ).resolves.toMatchObject({
      streamVersion: 3,
      classes: [{ label: 'Cleric', options: [{ label: 'Healing Word' }] }]
    })
    expect(getCharacterPreparationOptionsForUser).toHaveBeenCalledWith(
      {},
      '00000000-0000-0000-0000-000000000001',
      'user-1'
    )
  })
})
