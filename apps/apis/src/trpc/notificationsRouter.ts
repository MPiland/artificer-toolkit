import { createNotificationSession } from '@artificer-toolkit/functions'
import { notificationSessionDtoSchema } from '@artificer-toolkit/schema/api/notifications'
import { withExplicitAuthorityDb } from './dbContext.js'
import { authenticatedProcedure, createTRPCRouter } from './procedures.js'

const runtimeEnvironment = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }
).process?.env

function requiredEnvironmentVariable(name: string): string {
  const value = runtimeEnvironment?.[name]
  if (!value) throw new Error(`${name} is required.`)
  return value
}

export const notificationsRouter = createTRPCRouter({
  session: authenticatedProcedure.output(notificationSessionDtoSchema).query(({ ctx }) =>
    withExplicitAuthorityDb(ctx, (db, userId) =>
      createNotificationSession(db, userId, {
        secretKey: requiredEnvironmentVariable('NOVU_SECRET_KEY'),
        applicationIdentifier: requiredEnvironmentVariable('NOVU_APPLICATION_IDENTIFIER')
      })
    )
  )
})
