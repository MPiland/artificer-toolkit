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
import {
  createReusableDefinition,
  findInstalledGameSystemRuleCapability,
  getReusableDefinition,
  listReusableDefinitions,
  publishReusableDefinitionDraft,
  saveReusableDefinitionDraft
} from '@artificer-toolkit/functions'
import {
  createReusableDefinitionInputDtoSchema,
  getReusableDefinitionInputDtoSchema,
  listReusableDefinitionsInputDtoSchema,
  publishReusableDefinitionDraftInputDtoSchema,
  reusableDefinitionSummaryDtoSchema,
  reusableDefinitionWorkspaceDtoSchema,
  saveReusableDefinitionDraftInputDtoSchema
} from '@artificer-toolkit/schema/api/reusableDefinitions'
import { gameSystemRuleCapabilityDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { z } from 'zod'

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
  capability: authenticatedProcedure
    .input(idInputSchema)
    .output(gameSystemRuleCapabilityDtoSchema.nullable())
    .query(({ input }) => findInstalledGameSystemRuleCapability(input.id)),
  definitions: createTRPCRouter({
    create: authenticatedProcedure
      .input(createReusableDefinitionInputDtoSchema)
      .output(reusableDefinitionWorkspaceDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) => createReusableDefinition(db, userId, input))
      ),
    get: authenticatedProcedure
      .input(getReusableDefinitionInputDtoSchema)
      .output(reusableDefinitionWorkspaceDtoSchema)
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) =>
          getReusableDefinition(db, userId, input.definitionId)
        )
      ),
    list: authenticatedProcedure
      .input(listReusableDefinitionsInputDtoSchema)
      .output(z.array(reusableDefinitionSummaryDtoSchema))
      .query(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) =>
          listReusableDefinitions(db, userId, input.gameSystemId)
        )
      ),
    publish: authenticatedProcedure
      .input(publishReusableDefinitionDraftInputDtoSchema)
      .output(reusableDefinitionWorkspaceDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) => publishReusableDefinitionDraft(db, userId, input))
      ),
    saveDraft: authenticatedProcedure
      .input(saveReusableDefinitionDraftInputDtoSchema)
      .output(reusableDefinitionWorkspaceDtoSchema)
      .mutation(({ ctx, input }) =>
        withAuthenticatedDb(ctx, (db, userId) => saveReusableDefinitionDraft(db, userId, input))
      )
  }),
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
