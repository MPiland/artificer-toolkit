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
        replayed: false,
        version: 4
      }
    })
    const second = coordinator.enqueue(async () => {
      started.push('second')
      return {
        aggregateKind: 'CHARACTER' as const,
        aggregateId: '00000000-0000-4000-8000-000000000001',
        commandId: '00000000-0000-4000-8000-000000000003',
        replayed: false,
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
    let persisted = false
    const execute = async () => ({
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: '00000000-0000-4000-8000-000000000001',
      commandId: '00000000-0000-4000-8000-000000000002',
      replayed: persisted,
      version: 7
    })

    await expect(coordinator.enqueue(execute)).resolves.toMatchObject({
      replayed: false,
      roomVersion: 1
    })
    persisted = true
    await expect(coordinator.enqueue(execute)).resolves.toMatchObject({
      replayed: true,
      roomVersion: 1
    })
  })

  it('accepts a persisted replay after later commands advanced the aggregate', async () => {
    const aggregateId = '00000000-0000-4000-8000-000000000001'
    const coordinator = new LiveSessionCommandCoordinator([
      { aggregateKind: 'ENCOUNTER', aggregateId, version: 7 }
    ])

    await coordinator.enqueue(async () => ({
      aggregateKind: 'ENCOUNTER',
      aggregateId,
      commandId: '00000000-0000-4000-8000-000000000002',
      replayed: false,
      version: 8
    }))
    await coordinator.enqueue(async () => ({
      aggregateKind: 'ENCOUNTER',
      aggregateId,
      commandId: '00000000-0000-4000-8000-000000000003',
      replayed: false,
      version: 9
    }))

    await expect(
      coordinator.enqueue(async () => ({
        aggregateKind: 'ENCOUNTER',
        aggregateId,
        commandId: '00000000-0000-4000-8000-000000000002',
        replayed: true,
        version: 8
      }))
    ).resolves.toMatchObject({ replayed: true, roomVersion: 2 })
    expect(coordinator.aggregateVersions).toEqual([
      { aggregateKind: 'ENCOUNTER', aggregateId, version: 9 }
    ])
  })

  it('still rejects an older version that was not a persisted replay', async () => {
    const aggregateId = '00000000-0000-4000-8000-000000000001'
    const coordinator = new LiveSessionCommandCoordinator([
      { aggregateKind: 'ENCOUNTER', aggregateId, version: 9 }
    ])

    await expect(
      coordinator.enqueue(async () => ({
        aggregateKind: 'ENCOUNTER',
        aggregateId,
        commandId: '00000000-0000-4000-8000-000000000004',
        replayed: false,
        version: 8
      }))
    ).rejects.toThrow('advanced outside room ordering')
  })
})
