import { defineRoom, defineServer, type Server } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import type { Request, Response } from 'express'

import {
  createLiveSessionRoomDependencies,
  type LiveSessionRoomDependencies
} from './dependencies.js'
import { createLiveSessionRoomClass } from './liveSessionRoom.js'
import { LIVE_SESSION_ROOM_NAME } from '@artificer-toolkit/schema/api/liveSessions'

export const SESSION_HOST_HEALTH_PATH = '/health'

export function getSessionHostHealth() {
  return {
    service: 'artificer-session-host',
    status: 'ok'
  } as const
}

export function createSessionHostServer(
  dependencies: LiveSessionRoomDependencies = createLiveSessionRoomDependencies()
): Server {
  const liveSessionRoom = defineRoom(createLiveSessionRoomClass(dependencies)).filterBy([
    'campaignId',
    'sessionId'
  ])
  const server = defineServer({
    express(app) {
      app.disable('x-powered-by')
      app.get(SESSION_HOST_HEALTH_PATH, (_request: Request, response: Response) => {
        response.status(200).json(getSessionHostHealth())
      })
    },
    greet: false,
    rooms: { [LIVE_SESSION_ROOM_NAME]: liveSessionRoom },
    transport: new WebSocketTransport()
  })
  server.onShutdown(() => dependencies.dispose?.())
  return server
}

export type SessionHostServer = ReturnType<typeof createSessionHostServer>
