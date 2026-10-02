/** Private Session Worker → Convex HTTP routes. Convex registers these paths; the Worker calls them. */
export const LIVE_SESSION_ROUTE_PATHS = {
  capture: '/live-sessions/capture',
  roomAuthorization: '/live-sessions/room-authorization',
  roomInputs: '/live-sessions/room-inputs',
  bootstrap: '/live-sessions/bootstrap',
  activate: '/live-sessions/activate',
  recoverStorage: '/live-sessions/recover-storage',
  checkpoint: '/live-sessions/checkpoint',
  checkpointStage: '/live-sessions/checkpoint-stage',
  checkpointPart: '/live-sessions/checkpoint-part',
  checkpointCommit: '/live-sessions/checkpoint-commit',
  present: '/live-sessions/present',
  beginDrain: '/live-sessions/begin-drain',
  release: '/live-sessions/release'
} as const
