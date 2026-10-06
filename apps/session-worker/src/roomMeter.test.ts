import { afterEach, describe, expect, it, vi } from 'vitest'
import { meterFrame, meterStorage, RoomMeter, sqlRoomMeterStore } from './roomMeter.js'

const counters = { bytesRead: 10, bytesWritten: 4, documentsRead: 2, documentsWritten: 1 }
const none = { bytesRead: 0, bytesWritten: 0, documentsRead: 0, documentsWritten: 0 }
const io = {
  ...counters,
  sections: {
    fence: none,
    records: counters,
    scopes: none,
    holds: none,
    scenes: none,
    history: none,
    privateRolls: none,
    remainder: none
  }
}

afterEach(() => vi.restoreAllMocks())

/** A cursor that, like SqlStorageCursor, reports rows only as they are consumed. */
function fakeStorage() {
  return {
    sql: {
      exec(_query: string, ..._bindings: unknown[]) {
        const cursor = {
          rowsRead: 0,
          rowsWritten: 1,
          toArray() {
            cursor.rowsRead += 3
            return [1, 2, 3]
          }
        }
        return cursor
      }
    },
    marker: 'storage'
  }
}

describe('room meter', () => {
  it('counts requests, messages and frames by kind and type, and reports peak sockets per member', () => {
    const meter = new RoomMeter()
    meter.request('WEBSOCKET_MESSAGE')
    meter.request('WEBSOCKET_MESSAGE')
    meter.request('ALARM')
    meter.message('COMMAND')
    meter.message('COMMAND')
    meter.message('NOT_YET_DEFINED')
    meter.frame('STATE_SYNC')
    meter.admitted('a', 1)
    meter.admitted('a', 3)
    meter.admitted('a', 2)
    meter.admitted('b', 1)

    const { current } = meter.read()
    expect(current.requests).toEqual({ WEBSOCKET_MESSAGE: 2, HTTP: 0, ALARM: 1 })
    expect(current.messagesByType).toEqual({ COMMAND: 2, NOT_YET_DEFINED: 1 })
    expect(current.framesByType).toEqual({ STATE_SYNC: 1 })
    expect(current.admissions).toBe(4)
    expect(current.peakSocketsPerMember).toEqual([3, 1])
  })

  it('times commands whether they settle or throw', async () => {
    const meter = new RoomMeter()
    await meter.command(async () => 'ok')
    await expect(
      meter.command(async () => {
        throw new Error('failed')
      })
    ).rejects.toThrow('failed')
    expect(meter.read().current.commands.count).toBe(2)
  })

  it('totals checkpoints by reason and logs one structured line each', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const meter = new RoomMeter()
    meter.epoch('epoch-1')
    meter.checkpoint({ reason: 'BACKLOG', payloadBytes: 100, requests: 1, wallMs: 5, io })
    meter.checkpoint({ reason: 'BACKLOG', payloadBytes: 50, requests: 4, wallMs: 7, io })
    meter.checkpoint({ reason: 'DRAIN', payloadBytes: 10, requests: 1, wallMs: 1, io })

    const { checkpoints } = meter.read().current
    expect(checkpoints.BACKLOG).toEqual({
      count: 2,
      requests: 5,
      payloadBytes: 150,
      wallMs: 12,
      convex: {
        bytesRead: 20,
        bytesWritten: 8,
        documentsRead: 4,
        documentsWritten: 2,
        sections: {
          ...io.sections,
          records: { bytesRead: 20, bytesWritten: 8, documentsRead: 4, documentsWritten: 2 }
        }
      }
    })
    expect(checkpoints.DRAIN?.count).toBe(1)
    expect(checkpoints.ADMISSION).toBeUndefined()
    expect(log).toHaveBeenCalledTimes(3)
    const line = String(log.mock.calls[0]?.[0])
    expect(line.startsWith('[room-meter] ')).toBe(true)
    expect(JSON.parse(line.slice('[room-meter] '.length))).toMatchObject({
      event: 'checkpoint',
      epoch: 'epoch-1',
      reason: 'BACKLOG'
    })
  })

  it('closes the epoch at release with a summary and starts the next one empty', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const meter = new RoomMeter()
    meter.epoch('epoch-1')
    meter.request('HTTP')
    meter.admitted('a', 2)
    meter.release()

    const { current, released } = meter.read()
    expect(released).toHaveLength(1)
    expect(released[0]).toMatchObject({
      epoch: 'epoch-1',
      requests: { HTTP: 1 },
      peakSocketsPerMember: [2]
    })
    expect(released[0]!.endedAt).not.toBeNull()
    expect(current).toMatchObject({
      epoch: null,
      endedAt: null,
      admissions: 0,
      peakSocketsPerMember: []
    })
    expect(String(log.mock.calls.at(-1)?.[0])).toContain('"event":"release"')
  })
})

/** An in-memory `RoomMeterStore` that records each write. */
function memoryStore(initial: string | null = null) {
  const store = {
    state: initial,
    writes: 0,
    cleared: 0,
    read: () => store.state,
    write: (state: string) => {
      store.state = state
      store.writes += 1
    },
    clear: () => {
      store.state = null
      store.cleared += 1
    }
  }
  return store
}

describe('persisted room meter', () => {
  it('restores totals, released epochs and peaks after the room is rebuilt', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const store = memoryStore()
    const meter = new RoomMeter(store)
    meter.epoch('epoch-1')
    meter.request('ALARM')
    meter.admitted('a', 2)
    meter.checkpoint({ reason: 'BACKLOG', payloadBytes: 100, requests: 1, wallMs: 5, io })
    meter.release()
    meter.request('HTTP')
    meter.admitted('b', 3)
    await Promise.resolve()

    const restored = new RoomMeter(store)
    expect(restored.read()).toEqual(meter.read())
    expect(restored.read().released[0]?.checkpoints.BACKLOG?.count).toBe(1)
    expect(restored.read().current.peakSocketsPerMember).toEqual([3])
    restored.request('HTTP')
    expect(restored.read().current.requests.HTTP).toBe(2)
  })

  it('writes once per event turn however many counters changed', async () => {
    const store = memoryStore()
    const meter = new RoomMeter(store)
    meter.request('HTTP')
    meter.message('COMMAND')
    meter.rows(3, 1)
    expect(store.writes).toBe(0)
    await Promise.resolve()
    expect(store.writes).toBe(1)
    meter.request('HTTP')
    await Promise.resolve()
    expect(store.writes).toBe(2)
  })

  it.each(['not json', '{"totals":{}}'])('deletes a corrupt row (%s) and starts fresh', (state) => {
    const store = memoryStore(state)
    const meter = new RoomMeter(store)

    expect(store.cleared).toBe(1)
    expect(store.state).toBeNull()
    expect(meter.read().current.requests).toEqual({ WEBSOCKET_MESSAGE: 0, HTTP: 0, ALARM: 0 })
    expect(meter.read().released).toEqual([])
  })

  it('persists nothing without a store', async () => {
    const meter = new RoomMeter()
    meter.request('HTTP')
    await Promise.resolve()
    expect(meter.read().current.requests.HTTP).toBe(1)
  })

  it('keeps its single row in the raw SQL it is given', async () => {
    const rows = new Map<number, string>()
    const statements: string[] = []
    const sql = {
      exec(query: string, ...bindings: (string | number | ArrayBuffer | null)[]) {
        statements.push(query.trim().split(/\s+/).slice(0, 2).join(' '))
        if (query.includes('INSERT')) rows.set(1, String(bindings[0]))
        if (query.includes('DELETE')) rows.clear()
        return {
          rowsRead: 0,
          rowsWritten: 0,
          toArray: () => (rows.has(1) ? [{ state: rows.get(1) ?? null }] : [])
        }
      }
    }
    const meter = new RoomMeter(sqlRoomMeterStore(sql))
    meter.request('HTTP')
    await Promise.resolve()

    expect(statements).toEqual(['CREATE TABLE', 'SELECT state', 'INSERT INTO'])
    expect(new RoomMeter(sqlRoomMeterStore(sql)).read().current.requests.HTTP).toBe(1)
  })
})

describe('metered storage and watched sockets', () => {
  it('counts rows read and written once per consumed statement through the single SQL choke point', () => {
    const meter = new RoomMeter()
    const metered = meterStorage(fakeStorage(), meter)

    expect(metered.marker).toBe('storage')
    const cursor = metered.sql.exec('SELECT 1')
    expect(meter.read().current.sql).toEqual({ rowsRead: 0, rowsWritten: 1 })
    expect(cursor.toArray()).toEqual([1, 2, 3])
    expect(meter.read().current.sql).toEqual({ rowsRead: 3, rowsWritten: 1 })
    cursor.toArray()
    expect(meter.read().current.sql).toEqual({ rowsRead: 6, rowsWritten: 1 })
  })

  it('counts frames only for sockets the room watches', () => {
    const meter = new RoomMeter()
    const watched = {}
    const unknown = {}
    meter.watch(watched)

    meterFrame(watched, 'STATE_SYNC')
    meterFrame(watched, 'ENCOUNTER_SESSION')
    meterFrame(unknown, 'STATE_SYNC')

    expect(meter.read().current.framesByType).toEqual({ STATE_SYNC: 1, ENCOUNTER_SESSION: 1 })
  })
})
