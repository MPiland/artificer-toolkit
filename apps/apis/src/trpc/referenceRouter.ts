import {
  createAuthoredRouteIdRepository,
  createSystemRepository,
  getSystemListQuery
} from '@artificer-toolkit/db'
import {
  routeIdentityBySubjectRequestDtoSchema,
  routeIdentityDtoSchema,
  routeIdentityResolveRequestDtoSchema
} from '@artificer-toolkit/schema/api/routeIds'
import {
  systemListResponseDtoSchema,
  systemResponseDtoSchema
} from '@artificer-toolkit/schema/api/systems'
import { withAuthenticatedDb } from './dbContext.js'

import { authenticatedProcedure, createTRPCRouter, idInputSchema } from './procedures.js'

export const routeIdsRouter = createTRPCRouter({
  resolve: authenticatedProcedure
    .input(routeIdentityResolveRequestDtoSchema)
    .output(routeIdentityDtoSchema.nullable())
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db) => {
        const identity = await createAuthoredRouteIdRepository(db).resolveByPublicIdForUser(input)

        return identity
          ? {
              subjectKind: identity.subjectKind,
              subjectId: identity.subjectId,
              publicId: identity.publicId
            }
          : null
      })
    ),

  bySubject: authenticatedProcedure
    .input(routeIdentityBySubjectRequestDtoSchema)
    .output(routeIdentityDtoSchema.nullable())
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db) => {
        const identity = await createAuthoredRouteIdRepository(db).resolveBySubjectForUser(input)

        return identity
          ? {
              subjectKind: identity.subjectKind,
              subjectId: identity.subjectId,
              publicId: identity.publicId
            }
          : null
      })
    )
})

export const systemsRouter = createTRPCRouter({
  list: authenticatedProcedure
    .output(systemListResponseDtoSchema)
    .query(({ ctx }) => withAuthenticatedDb(ctx, async (db) => getSystemListQuery(db))),

  get: authenticatedProcedure
    .input(idInputSchema)
    .output(systemResponseDtoSchema)
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db) => createSystemRepository(db).findById(input.id))
    )
})
