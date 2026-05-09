import { describe, expect, it } from 'vitest'
import { appRouter } from './router.js'

describe('tRPC router auth', () => {
  it('requires server-side auth context for product data procedures', async () => {
    const caller = appRouter.createCaller({ userId: null })

    await expect(caller.systems.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.content.spells.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.characters.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(caller.nodeRuntime.resolve({ mapId: 'spell', values: {} })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
