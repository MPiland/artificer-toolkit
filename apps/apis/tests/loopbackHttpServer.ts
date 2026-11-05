import { createServer, type RequestListener } from 'node:http'

/**
 * An HTTP server for a loopback test fixture that shares its process with the client calling it.
 * Node closes an idle keep-alive socket on a timer, while the client may reuse that socket for up to
 * that timeout less a margin. When a synchronous stretch of test work outlasts the margin, the
 * server's timer fires before it reads the request already sent on the socket, and the client sees
 * `fetch failed` (ECONNRESET). With no server timeout, only the client retires idle sockets, so a
 * reused socket is always open; `server.closeAllConnections()` still ends them at shutdown.
 */
export function createLoopbackServer(listener: RequestListener) {
  const server = createServer(listener)
  server.keepAliveTimeout = 0
  return server
}
