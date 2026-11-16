import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installLiveSessionSpy,
  latestEncounter,
  latestStateSync,
  liveFramesReceived,
  liveWritesOfType,
  storyLiveWrite
} from './storyLiveSession'

/** The platform's socket: records what reaches the wire and lets a test play the server. */
class WireSocket extends EventTarget {
  static readonly sent: string[] = []

  constructor(
    readonly url: string,
    readonly protocols?: string | string[]
  ) {
    super()
  }

  send(data: string): void {
    WireSocket.sent.push(data)
  }

  receive(frame: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(frame) }))
  }
}

const campaignId = crypto.randomUUID()
const roomUrl = `ws://127.0.0.1:8787/live-session/${campaignId}`
const command = {
  command: {
    command: {
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 1,
      sceneId: crypto.randomUUID(),
      type: 'UNDO_LAST_SCENE_MOVE'
    },
    scope: 'SCENE'
  },
  expectedSessionSequence: 1,
  type: 'COMMAND'
}

const fogBegin = {
  input: {
    chunkManifest: [
      { checksum: 'a'.repeat(64), index: 0 },
      { checksum: 'b'.repeat(64), index: 1 }
    ],
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 3,
    layer: { height: 1, ownerUserId: null, width: 10 },
    sceneId: crypto.randomUUID(),
    type: 'PATCH_SCENE_FOG'
  },
  type: 'SCENE_FOG_BEGIN'
} as const
const fogAppend = {
  commandId: fogBegin.input.commandId,
  input: {
    chunks: [{ data: 'AA==', height: 1, index: 0, width: 1, x: 0, y: 0 }],
    offset: 0,
    saveId: fogBegin.input.commandId
  },
  type: 'SCENE_FOG_APPEND'
} as const

function openSocket(url: string): WireSocket {
  return new (globalThis.WebSocket as unknown as new (url: string) => WireSocket)(url)
}

describe('story live-session spy', () => {
  let restore: () => void = () => undefined

  afterEach(() => {
    restore()
    WireSocket.sent.length = 0
    vi.unstubAllGlobals()
  })

  function installOverWireSocket() {
    vi.stubGlobal('WebSocket', WireSocket)
    restore = installLiveSessionSpy()
  }

  it('records a room COMMAND frame and never sends it', () => {
    installOverWireSocket()
    const socket = openSocket(roomUrl)

    socket.send(JSON.stringify(command))

    expect(storyLiveWrite).toHaveBeenCalledWith(command)
    expect(WireSocket.sent).toEqual([])
  })

  it('records the fog staging frames, never sends them, and answers each with its progress', async () => {
    installOverWireSocket()
    const socket = openSocket(roomUrl)

    socket.send(JSON.stringify(fogBegin))
    socket.send(JSON.stringify(fogAppend))
    await Promise.resolve()

    expect(storyLiveWrite.mock.calls).toEqual([[fogBegin], [fogAppend]])
    expect(WireSocket.sent).toEqual([])
    const progress = (receivedChunks: number) => ({
      progress: {
        commandId: fogBegin.input.commandId,
        receivedChunks,
        saveId: fogBegin.input.commandId,
        sceneId: fogBegin.input.sceneId,
        status: 'RECEIVING',
        totalChunks: 2
      },
      type: 'SCENE_FOG_PROGRESS'
    })
    expect(liveFramesReceived()).toEqual([progress(0), progress(1)])
  })

  it('lists the recorded writes of one frame type', () => {
    installOverWireSocket()
    const socket = openSocket(roomUrl)

    socket.send(JSON.stringify(command))
    socket.send(JSON.stringify(fogBegin))

    expect(liveWritesOfType('COMMAND')).toEqual([command])
    expect(liveWritesOfType('SCENE_FOG_BEGIN')).toEqual([fogBegin])
    expect(liveWritesOfType('SCENE_FOG_APPEND')).toEqual([])
  })

  it('refuses a fog append that arrives before its begin', () => {
    installOverWireSocket()

    expect(() => openSocket(roomUrl).send(JSON.stringify(fogAppend))).toThrow(
      'A fog append arrived before its begin.'
    )
  })

  it('has no state to read until the room syncs one', () => {
    installOverWireSocket()
    const socket = openSocket(roomUrl)
    expect(() => latestStateSync()).toThrow('The room has sent this story no state.')

    socket.receive({ type: 'AUTHENTICATION_REQUIRED' })

    expect(() => latestStateSync()).toThrow('The room has sent this story no state.')
  })

  it('has no Encounter to read until the room holds one', () => {
    installOverWireSocket()
    const socket = openSocket(roomUrl)
    socket.receive({ session: { held: false }, type: 'ENCOUNTER_SESSION' })

    expect(() => latestEncounter()).toThrow('The room holds no Encounter for this story.')
  })

  it('sends the room every other frame', () => {
    installOverWireSocket()
    const authenticate = JSON.stringify({ accessToken: 'story-token', type: 'AUTHENTICATE' })

    openSocket(roomUrl).send(authenticate)

    expect(WireSocket.sent).toEqual([authenticate])
    expect(storyLiveWrite).not.toHaveBeenCalled()
  })

  it('leaves a socket that is not a room untouched', () => {
    installOverWireSocket()
    const convexFrame = JSON.stringify({ type: 'Connect' })

    openSocket('ws://127.0.0.1:3210/api/1.0/sync').send(convexFrame)

    expect(WireSocket.sent).toEqual([convexFrame])
    expect(storyLiveWrite).not.toHaveBeenCalled()
  })

  it('records the room frames in arrival order and clears them on the next install', () => {
    installOverWireSocket()
    const socket = openSocket(roomUrl)

    socket.receive({ type: 'AUTHENTICATION_REQUIRED' })
    socket.receive({ type: 'TRANSIENT_READY', campaignId })

    expect(liveFramesReceived()).toEqual([
      { type: 'AUTHENTICATION_REQUIRED' },
      { type: 'TRANSIENT_READY', campaignId }
    ])
    restore()
    vi.stubGlobal('WebSocket', WireSocket)
    restore = installLiveSessionSpy()
    expect(liveFramesReceived()).toEqual([])
  })

  it('restores the platform socket', () => {
    vi.stubGlobal('WebSocket', WireSocket)
    restore = installLiveSessionSpy()
    expect(globalThis.WebSocket).not.toBe(WireSocket)

    restore()

    expect(globalThis.WebSocket).toBe(WireSocket)
  })
})
