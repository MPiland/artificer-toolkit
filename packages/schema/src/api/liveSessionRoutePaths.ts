/** Private Session Worker → Convex HTTP routes. Convex registers these paths; the Worker calls them. */
export const LIVE_SESSION_ROUTE_PATHS = {
  capture: '/live-sessions/capture',
  roomAuthorization: '/live-sessions/room-authorization',
  roomSceneCapture: '/live-sessions/room-scene-capture',
  roomInputs: '/live-sessions/room-inputs',
  bootstrap: '/live-sessions/bootstrap',
  activate: '/live-sessions/activate',
  recoverStorage: '/live-sessions/recover-storage',
  checkpoint: '/live-sessions/checkpoint',
  present: '/live-sessions/present',
  beginDrain: '/live-sessions/begin-drain',
  release: '/live-sessions/release'
} as const
