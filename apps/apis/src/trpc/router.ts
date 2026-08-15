import { applicationRouter, accountRouter } from './accountRouter.js'
import { authoredContentRouter } from './authoredContentRouter.js'
import { campaignRouter } from './campaignRouter.js'
import { encounterRouter } from './encounterRouter.js'
import { mediaRouter } from './mediaRouter.js'
import { routeIdsRouter, systemsRouter } from './referenceRouter.js'
import { characterRouter } from './characterRouter.js'
import { rollRouter } from './rollRouter.js'
import { nodeRuntimeRouter } from './nodeRuntimeRouter.js'
import { socialHubRouter } from './socialHubRouter.js'
import { notificationsRouter } from './notificationsRouter.js'
import { ruleRouter } from './ruleRouter.js'
import { createTRPCRouter } from './procedures.js'

export const appRouter = createTRPCRouter({
  application: applicationRouter,
  account: accountRouter,
  campaigns: campaignRouter,
  encounters: encounterRouter,
  media: mediaRouter,
  routeIds: routeIdsRouter,
  systems: systemsRouter,
  content: authoredContentRouter,
  characters: characterRouter,
  rolls: rollRouter,
  socialHub: socialHubRouter,
  notifications: notificationsRouter,
  nodeRuntime: nodeRuntimeRouter,
  rules: ruleRouter
})

export type AppRouter = typeof appRouter
