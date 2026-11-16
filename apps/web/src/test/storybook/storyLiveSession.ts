import { fn } from 'storybook/test'
import {
  LIVE_SESSION_PATH_PREFIX,
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketClientMessageDto,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'

type StateSyncFrame = Extract<LiveSessionWebSocketServerMessageDto, { type: 'STATE_SYNC' }>
type EncounterSessionFrame = Extract<
  LiveSessionWebSocketServerMessageDto,
  { type: 'ENCOUNTER_SESSION' }
>
type FogBeginFrame = Extract<LiveSessionWebSocketClientMessageDto, { type: 'SCENE_FOG_BEGIN' }>
type FogAppendFrame = Extract<LiveSessionWebSocketClientMessageDto, { type: 'SCENE_FOG_APPEND' }>

/**
 * Every write frame a story's live-session client tried to send: a COMMAND, and the two frames that
 * stage a GM fog patch. A Session Worker write is a story write (D218), so it is recorded here and
 * never reaches the room: the seeded Scene and Encounter stay shared between stories.
 */
export const storyLiveWrite = fn()

const receivedFrames: LiveSessionWebSocketServerMessageDto[] = []

/** The frames the room sent this story, in arrival order. */
export function liveFramesReceived(): readonly LiveSessionWebSocketServerMessageDto[] {
  return receivedFrames
}

/** The room's latest full state for this story's recipient. */
export function latestStateSync(): StateSyncFrame {
  const syncs = receivedFrames.filter(
    (candidate): candidate is StateSyncFrame => candidate.type === 'STATE_SYNC'
  )
  const frame = syncs[syncs.length - 1]
  if (!frame) throw new Error('The room has sent this story no state.')
  return frame
}

/** The Encounter the room holds for this story's recipient, as the window shows it. */
export function latestEncounter() {
  const held = receivedFrames
    .filter(
      (candidate): candidate is EncounterSessionFrame => candidate.type === 'ENCOUNTER_SESSION'
    )
    .flatMap(({ session }) => (session.held ? [session.state.encounter] : []))
  const encounter = held[held.length - 1]
  if (!encounter) throw new Error('The room holds no Encounter for this story.')
  return encounter
}

/** The write frames of one type this story's client tried to send, as the room's schema parses them. */
export function liveWritesOfType<Type extends LiveSessionWebSocketClientMessageDto['type']>(
  type: Type
): Extract<LiveSessionWebSocketClientMessageDto, { type: Type }>[] {
  return storyLiveWrite.mock.calls
    .map(([frame]) => liveSessionWebSocketClientMessageDtoSchema.parse(frame))
    .filter(
      (message): message is Extract<LiveSessionWebSocketClientMessageDto, { type: Type }> =>
        message.type === type
    )
}

/**
 * What the room answers a fog staging frame: the progress the client parses, built through the real
 * schema from the recorded frame. The save is named after the patch's command, and the room has
 * received every chunk the client has appended so far.
 */
function fogProgress(
  frame: FogBeginFrame | FogAppendFrame,
  begun: ReadonlyMap<string, FogBeginFrame['input']>
): LiveSessionWebSocketServerMessageDto {
  const begin = frame.type === 'SCENE_FOG_BEGIN' ? frame.input : begun.get(frame.commandId)
  if (!begin) throw new Error('A fog append arrived before its begin.')
  return liveSessionWebSocketServerMessageDtoSchema.parse({
    progress: {
      commandId: begin.commandId,
      receivedChunks:
        frame.type === 'SCENE_FOG_APPEND' ? frame.input.offset + frame.input.chunks.length : 0,
      saveId: begin.commandId,
      sceneId: begin.sceneId,
      status: 'RECEIVING',
      totalChunks: begin.chunkManifest.length
    },
    type: 'SCENE_FOG_PROGRESS'
  })
}

/**
 * Replaces the browser's `WebSocket` with one that records the room's frames and holds back the
 * client's write frames; every other frame, and every non-room socket, goes through unchanged.
 * Returns the restore function.
 */
export function installLiveSessionSpy(): () => void {
  const NativeWebSocket = globalThis.WebSocket
  receivedFrames.length = 0
  storyLiveWrite.mockClear()

  class StoryLiveSessionSocket extends NativeWebSocket {
    readonly #isRoom: boolean
    readonly #fogBegins = new Map<string, FogBeginFrame['input']>()

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
          storyLiveWrite(message)
          return
        }
        if (message.type === 'SCENE_FOG_BEGIN' || message.type === 'SCENE_FOG_APPEND') {
          storyLiveWrite(message)
          if (message.type === 'SCENE_FOG_BEGIN')
            this.#fogBegins.set(message.input.commandId, message.input)
          const progress = JSON.stringify(fogProgress(message, this.#fogBegins))
          queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: progress })))
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
