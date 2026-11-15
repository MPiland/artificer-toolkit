import { afterEach, describe, expect, it, vi } from 'vitest'
import { liveFramesReceived, installLiveSessionSpy, storyLiveCommand } from './storyLiveSession'

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

    expect(storyLiveCommand).toHaveBeenCalledWith(command)
    expect(WireSocket.sent).toEqual([])
  })

  it('sends the room every other frame', () => {
    installOverWireSocket()
    const authenticate = JSON.stringify({ accessToken: 'story-token', type: 'AUTHENTICATE' })

    openSocket(roomUrl).send(authenticate)

    expect(WireSocket.sent).toEqual([authenticate])
    expect(storyLiveCommand).not.toHaveBeenCalled()
  })

  it('leaves a socket that is not a room untouched', () => {
    installOverWireSocket()
    const convexFrame = JSON.stringify({ type: 'Connect' })

    openSocket('ws://127.0.0.1:3210/api/1.0/sync').send(convexFrame)

    expect(WireSocket.sent).toEqual([convexFrame])
    expect(storyLiveCommand).not.toHaveBeenCalled()
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
