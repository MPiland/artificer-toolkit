import { afterEach, describe, expect, it, vi } from 'vitest'
import { meterFrame, meterStorage, RoomMeter } from './roomMeter.js'

const io = { bytesRead: 10, bytesWritten: 4, documentsRead: 2, documentsWritten: 1 }

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
    meter.checkpoint({ reason: 'DEADLINE', payloadBytes: 100, requests: 1, wallMs: 5, io })
    meter.checkpoint({ reason: 'DEADLINE', payloadBytes: 50, requests: 4, wallMs: 7, io })
    meter.checkpoint({ reason: 'DRAIN', payloadBytes: 10, requests: 1, wallMs: 1, io })

    const { checkpoints } = meter.read().current
    expect(checkpoints.DEADLINE).toEqual({
      count: 2,
      requests: 5,
      payloadBytes: 150,
      wallMs: 12,
      convex: { bytesRead: 20, bytesWritten: 8, documentsRead: 4, documentsWritten: 2 }
    })
    expect(checkpoints.DRAIN?.count).toBe(1)
    expect(checkpoints.ADMISSION).toBeUndefined()
    expect(log).toHaveBeenCalledTimes(3)
    const line = String(log.mock.calls[0]?.[0])
    expect(line.startsWith('[room-meter] ')).toBe(true)
    expect(JSON.parse(line.slice('[room-meter] '.length))).toMatchObject({
      event: 'checkpoint',
      epoch: 'epoch-1',
      reason: 'DEADLINE'
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
