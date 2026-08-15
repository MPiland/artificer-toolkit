import { describe, expect, it } from 'vitest'

import { LiveSessionCommandCoordinator } from './liveSessionCommandCoordinator.js'

describe('LiveSessionCommandCoordinator', () => {
  it('serializes durable commands and advances room versions only after execution succeeds', async () => {
    const coordinator = new LiveSessionCommandCoordinator([
      {
        aggregateKind: 'CHARACTER',
        aggregateId: '00000000-0000-4000-8000-000000000001',
        version: 3
      }
    ])
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const started: string[] = []
    const first = coordinator.enqueue(async () => {
      started.push('first')
      await firstGate
      return {
        aggregateKind: 'CHARACTER' as const,
        aggregateId: '00000000-0000-4000-8000-000000000001',
        commandId: '00000000-0000-4000-8000-000000000002',
        version: 4
      }
    })
    const second = coordinator.enqueue(async () => {
      started.push('second')
      return {
        aggregateKind: 'CHARACTER' as const,
        aggregateId: '00000000-0000-4000-8000-000000000001',
        commandId: '00000000-0000-4000-8000-000000000003',
        version: 5
      }
    })

    await Promise.resolve()
    expect(started).toEqual(['first'])
    expect(coordinator.roomVersion).toBe(0)
    releaseFirst()
    await expect(first).resolves.toMatchObject({ replayed: false, roomVersion: 1 })
    await expect(second).resolves.toMatchObject({ replayed: false, roomVersion: 2 })
    expect(started).toEqual(['first', 'second'])
  })

  it('returns an idempotent replay without publishing another room version', async () => {
    const coordinator = new LiveSessionCommandCoordinator([])
    const execute = async () => ({
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: '00000000-0000-4000-8000-000000000001',
      commandId: '00000000-0000-4000-8000-000000000002',
      version: 7
    })

    await expect(coordinator.enqueue(execute)).resolves.toMatchObject({
      replayed: false,
      roomVersion: 1
    })
    await expect(coordinator.enqueue(execute)).resolves.toMatchObject({
      replayed: true,
      roomVersion: 1
    })
  })
})
