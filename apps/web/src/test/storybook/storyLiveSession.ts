import { fn } from 'storybook/test'
import {
  LIVE_SESSION_PATH_PREFIX,
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'

/**
 * Every COMMAND frame a story's live-session client tried to send. A Session Worker command is a
 * write (D218), so it is recorded here and never reaches the room: the seeded Scene and Encounter
 * stay shared between stories.
 */
export const storyLiveCommand = fn()

const receivedFrames: LiveSessionWebSocketServerMessageDto[] = []

/** The frames the room sent this story, in arrival order. */
export function liveFramesReceived(): readonly LiveSessionWebSocketServerMessageDto[] {
  return receivedFrames
}

/**
 * Replaces the browser's `WebSocket` with one that records the room's frames and holds back the
 * client's COMMAND frames; every other frame, and every non-room socket, goes through unchanged.
 * Returns the restore function.
 */
export function installLiveSessionSpy(): () => void {
  const NativeWebSocket = globalThis.WebSocket
  receivedFrames.length = 0
  storyLiveCommand.mockClear()

  class StoryLiveSessionSocket extends NativeWebSocket {
    readonly #isRoom: boolean

    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols)
      this.#isRoom = new URL(url).pathname.startsWith(`${LIVE_SESSION_PATH_PREFIX}/`)
      if (!this.#isRoom) return
      this.addEventListener('message', ({ data }) => {
        if (typeof data !== 'string') return
        receivedFrames.push(liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(data)))
      })
    }

    override send(data: Parameters<WebSocket['send']>[0]): void {
      if (this.#isRoom && typeof data === 'string') {
        const message = liveSessionWebSocketClientMessageDtoSchema.parse(JSON.parse(data))
        if (message.type === 'COMMAND') {
          storyLiveCommand(message)
          return
        }
      }
      super.send(data)
    }
  }

  globalThis.WebSocket = StoryLiveSessionSocket
  return () => {
    globalThis.WebSocket = NativeWebSocket
  }
}
