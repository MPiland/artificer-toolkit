import { describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import { createFeatSubjectAuthoringService } from '../services/subjects/featAuthoring.js'

describe('service orchestration boundaries', () => {
  it('subject service runs validate -> compile -> persist in order', async () => {
    const input = { any: 'input' }
    const authored = { id: 'feat-1', systemId: 'sys-1' }
    const compiled = { id: 'compiled-feat-1' }

    const events: string[] = []

    const validate = vi.fn((payload: unknown) => {
      events.push('validate')
      expect(payload).toBe(input)
      return authored as never
    })
    const compile = vi.fn((payload: unknown) => {
      events.push('compile')
      expect(payload).toBe(authored)
      return compiled as never
    })
    const persist = vi.fn(async (payload: { authored: unknown; compiled: unknown }) => {
      events.push('persist')
      expect(payload).toEqual({ authored, compiled })
    })

    const service = createFeatSubjectAuthoringService({} as DBLike, {
      validate,
      compile,
      persist
    })

    const result = await service.execute(input)

    expect(result).toEqual({ authored, compiled, persisted: undefined })
    expect(events).toEqual(['validate', 'compile', 'persist'])
  })
})

describe('service read-path delegation', () => {
  it('subject service findById delegates to injected dep', async () => {
    const authored = { id: 'feat-1', systemId: 'sys-1' }
    const findById = vi.fn(async (_id: string) => authored as never)

    const service = createFeatSubjectAuthoringService({} as DBLike, {
      validate: (x) => x as never,
      compile: (x) => x as never,
      persist: async () => {},
      findById
    })

    const result = await service.findById('feat-1')

    expect(findById).toHaveBeenCalledWith('feat-1')
    expect(result).toBe(authored)
  })

  it('subject service findAll delegates to injected dep', async () => {
    const items = [{ id: 'feat-1' }, { id: 'feat-2' }]
    const findAll = vi.fn(async () => items as never[])

    const service = createFeatSubjectAuthoringService({} as DBLike, {
      validate: (x) => x as never,
      compile: (x) => x as never,
      persist: async () => {},
      findAll
    })

    const result = await service.findAll({ systemId: 'sys-1' })

    expect(findAll).toHaveBeenCalledWith({ systemId: 'sys-1' })
    expect(result).toBe(items)
  })
})
