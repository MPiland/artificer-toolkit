import { ws } from 'msw'

/**
 * Test Convex clients are built over placeholder `*.convex.cloud` deployments and never read from
 * them. Their sync socket opens against this local handler so a test cannot reach the network.
 */
const convexSync = ws.link('wss://*.convex.cloud/api/:version/sync')

export const handlers = [convexSync.addEventListener('connection', () => undefined)]
