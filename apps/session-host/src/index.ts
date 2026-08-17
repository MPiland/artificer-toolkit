import { createSessionHostServer } from './app.js'
import { resolveSessionHostPort } from './config.js'
import { createLiveSessionRoomDependencies } from './dependencies.js'

const port = resolveSessionHostPort()
const server = createSessionHostServer(
  createLiveSessionRoomDependencies({
    onCharacterCommandTiming: (timing) => {
      console.info(JSON.stringify({ sessionHostCharacterCommandTiming: timing }))
    },
    onEncounterCommandTiming: (timing) => {
      console.info(JSON.stringify({ sessionHostEncounterCommandTiming: timing }))
    }
  })
)

const shutdown = async () => {
  await server.gracefullyShutdown(false)
}
process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

await server.listen(port)
console.info(`Artificer session host listening on port ${port}.`)
