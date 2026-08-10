import {
  attachImage,
  createImageUploadIntent,
  finalizeImageUpload,
  getImage,
  removeImage
} from '@artificer-toolkit/functions'
import {
  attachImageInputSchema,
  createImageUploadIntentInputSchema,
  createImageUploadIntentOutputSchema,
  finalizeImageUploadInputSchema,
  finalizeImageUploadOutputSchema,
  imageLookupInputSchema,
  removeImageInputSchema,
  signedImageDeliveryDtoSchema
} from '@artificer-toolkit/schema/api/media'
import { requireUserId, withAuthenticatedDb, withDb } from './dbContext.js'

import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

export const mediaRouter = createTRPCRouter({
  createImageUpload: authenticatedProcedure
    .input(createImageUploadIntentInputSchema)
    .output(createImageUploadIntentOutputSchema)
    .mutation(({ ctx, input }) => {
      const userId = requireUserId(ctx)
      return withDb(ctx, (db) => createImageUploadIntent(db, userId, input))
    }),
  finalizeImageUpload: authenticatedProcedure
    .input(finalizeImageUploadInputSchema)
    .output(finalizeImageUploadOutputSchema)
    .mutation(({ ctx, input }) => {
      const userId = requireUserId(ctx)
      return withDb(ctx, (db) => finalizeImageUpload(db, userId, input.assetId))
    }),
  attachImage: authenticatedProcedure
    .input(attachImageInputSchema)
    .output(okResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx)
      await withDb(ctx, (db) => attachImage(db, userId, input))
      return { ok: true as const }
    }),
  removeImage: authenticatedProcedure
    .input(removeImageInputSchema)
    .output(okResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx)
      await withDb(ctx, (db) => removeImage(db, userId, input))
      return { ok: true as const }
    }),
  getImage: authenticatedProcedure
    .input(imageLookupInputSchema)
    .output(signedImageDeliveryDtoSchema.nullable())
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, (db, userId) => getImage(db, userId, input))
    )
})
