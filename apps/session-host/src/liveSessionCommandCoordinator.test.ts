import { describe, expect, it } from 'vitest'

import { LiveSessionCommandCoordinator } from './liveSessionCommandCoordinator.js'

describe('LiveSessionCommandCoordinator', () => {
  it('serializes durable commands and advances room versions only after execution succeeds', async () => {
    const coordinator = new LiveSessionCommandCoordinator([
      {
        aggregateKind: 'CAMPAIGN',
        aggregateId: '00000000-0000-4000-8000-000000000010',
        version: 2
      },
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
    const aggregate = {
      aggregateKind: 'CHARACTER' as const,
      aggregateId: '00000000-0000-4000-8000-000000000001'
    }
    const conflictKeys = [`character:${aggregate.aggregateId}`] as const
    const first = coordinator.enqueue(aggregate, conflictKeys, async () => {
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
    const second = coordinator.enqueue(aggregate, conflictKeys, async () => {
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
    expect(coordinator.aggregateVersions).toContainEqual({
      aggregateKind: 'CAMPAIGN',
      aggregateId: '00000000-0000-4000-8000-000000000010',
      version: 2
    })
  })

  it('executes different aggregates concurrently without sacrificing per-aggregate order', async () => {
    const coordinator = new LiveSessionCommandCoordinator([])
    let releaseCharacter!: () => void
    const characterGate = new Promise<void>((resolve) => {
      releaseCharacter = resolve
    })
    const started: string[] = []
    const character = coordinator.enqueue(
      {
        aggregateKind: 'CHARACTER',
        aggregateId: '00000000-0000-4000-8000-000000000001'
      },
      ['character:00000000-0000-4000-8000-000000000001'],
      async () => {
        started.push('character')
        await characterGate
        return {
          aggregateKind: 'CHARACTER' as const,
          aggregateId: '00000000-0000-4000-8000-000000000001',
          commandId: '00000000-0000-4000-8000-000000000002',
          replayed: false,
          version: 1
        }
      }
    )
    const encounter = coordinator.enqueue(
      {
        aggregateKind: 'ENCOUNTER',
        aggregateId: '00000000-0000-4000-8000-000000000003'
      },
      ['encounter:00000000-0000-4000-8000-000000000003'],
      async () => {
        started.push('encounter')
        return {
          aggregateKind: 'ENCOUNTER' as const,
          aggregateId: '00000000-0000-4000-8000-000000000003',
          commandId: '00000000-0000-4000-8000-000000000004',
          replayed: false,
          version: 1
        }
      }
    )

    await expect(encounter).resolves.toMatchObject({ roomVersion: 1 })
    expect(started).toEqual(['character', 'encounter'])
    releaseCharacter()
    await expect(character).resolves.toMatchObject({ roomVersion: 2 })
  })

  it('drains accepted durable commands before shutdown can continue', async () => {
    const coordinator = new LiveSessionCommandCoordinator([])
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const execution = coordinator.enqueue(
      {
        aggregateKind: 'ENCOUNTER',
        aggregateId: '00000000-0000-4000-8000-000000000001'
      },
      ['encounter:00000000-0000-4000-8000-000000000001'],
      async () => {
        await gate
        return {
          aggregateKind: 'ENCOUNTER' as const,
          aggregateId: '00000000-0000-4000-8000-000000000001',
          commandId: '00000000-0000-4000-8000-000000000002',
          replayed: false,
          version: 1
        }
      }
    )
    let drained = false
    const drain = coordinator.drain().then(() => {
      drained = true
    })

    await Promise.resolve()
    expect(drained).toBe(false)
    release()
    await execution
    await drain
    expect(drained).toBe(true)
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

    const aggregate = {
      aggregateKind: 'ENCOUNTER' as const,
      aggregateId: '00000000-0000-4000-8000-000000000001'
    }
    const conflictKeys = [`encounter:${aggregate.aggregateId}`] as const
    await expect(coordinator.enqueue(aggregate, conflictKeys, execute)).resolves.toMatchObject({
      replayed: false,
      roomVersion: 1
    })
    persisted = true
    await expect(coordinator.enqueue(aggregate, conflictKeys, execute)).resolves.toMatchObject({
      replayed: true,
      roomVersion: 1
    })
  })

  it('accepts a persisted replay after later commands advanced the aggregate', async () => {
    const aggregateId = '00000000-0000-4000-8000-000000000001'
    const coordinator = new LiveSessionCommandCoordinator([
      { aggregateKind: 'ENCOUNTER', aggregateId, version: 7 }
    ])

    const aggregate = { aggregateKind: 'ENCOUNTER' as const, aggregateId }
    const conflictKeys = [`encounter:${aggregateId}`] as const
    await coordinator.enqueue(aggregate, conflictKeys, async () => ({
      aggregateKind: 'ENCOUNTER',
      aggregateId,
      commandId: '00000000-0000-4000-8000-000000000002',
      replayed: false,
      version: 8
    }))
    await coordinator.enqueue(aggregate, conflictKeys, async () => ({
      aggregateKind: 'ENCOUNTER',
      aggregateId,
      commandId: '00000000-0000-4000-8000-000000000003',
      replayed: false,
      version: 9
    }))

    await expect(
      coordinator.enqueue(aggregate, conflictKeys, async () => ({
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

  it('accepts a generated aggregate identity for first scene attachment', async () => {
    const coordinator = new LiveSessionCommandCoordinator([])
    const sceneId = '00000000-0000-4000-8000-000000000010'

    await expect(
      coordinator.enqueue(
        { aggregateKind: 'SCENE', aggregateId: null },
        ['encounter:00000000-0000-4000-8000-000000000011'],
        async () => ({
          aggregateId: sceneId,
          aggregateKind: 'SCENE' as const,
          commandId: '00000000-0000-4000-8000-000000000012',
          replayed: false,
          version: 0
        })
      )
    ).resolves.toMatchObject({ replayed: false, roomVersion: 1 })
    expect(coordinator.aggregateVersions).toEqual([
      { aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }
    ])
  })

  it('runs disjoint scene resources concurrently but publishes their committed versions in order', async () => {
    const sceneId = '00000000-0000-4000-8000-000000000001'
    const coordinator = new LiveSessionCommandCoordinator([
      { aggregateKind: 'SCENE', aggregateId: sceneId, version: 0 }
    ])
    let releaseFirstResponse!: () => void
    const firstResponseGate = new Promise<void>((resolve) => {
      releaseFirstResponse = resolve
    })
    let firstCommitted = false
    const first = coordinator.enqueue(
      { aggregateKind: 'SCENE', aggregateId: sceneId },
      [`scene:${sceneId}:token:one`],
      async () => {
        firstCommitted = true
        await firstResponseGate
        return {
          aggregateKind: 'SCENE' as const,
          aggregateId: sceneId,
          commandId: '00000000-0000-4000-8000-000000000002',
          replayed: false,
          version: 1
        }
      }
    )
    const second = coordinator.enqueue(
      { aggregateKind: 'SCENE', aggregateId: sceneId },
      [`scene:${sceneId}:barrier:two`],
      async () => {
        expect(firstCommitted).toBe(true)
        return {
          aggregateKind: 'SCENE' as const,
          aggregateId: sceneId,
          commandId: '00000000-0000-4000-8000-000000000003',
          replayed: false,
          version: 2
        }
      }
    )
    let secondResolved = false
    void second.then(() => {
      secondResolved = true
    })

    await Promise.resolve()
    expect(secondResolved).toBe(false)
    releaseFirstResponse()
    await expect(first).resolves.toMatchObject({ roomVersion: 1 })
    await expect(second).resolves.toMatchObject({ roomVersion: 2 })
  })

  it('still rejects an older version that was not a persisted replay', async () => {
    const aggregateId = '00000000-0000-4000-8000-000000000001'
    const coordinator = new LiveSessionCommandCoordinator([
      { aggregateKind: 'ENCOUNTER', aggregateId, version: 9 }
    ])

    await expect(
      coordinator.enqueue(
        { aggregateKind: 'ENCOUNTER', aggregateId },
        [`encounter:${aggregateId}`],
        async () => ({
          aggregateKind: 'ENCOUNTER',
          aggregateId,
          commandId: '00000000-0000-4000-8000-000000000004',
          replayed: false,
          version: 8
        })
      )
    ).rejects.toThrow('did not advance')
  })
})
