import {
  attachImage,
  createCampaignFileUploadIntent,
  createImageUploadIntent,
  createVttMapUploadIntent,
  finalizeCampaignFileUpload,
  finalizeImageUpload,
  finalizeVttMapUpload,
  getImage,
  getVttMapDelivery,
  removeImage
} from '@artificer-toolkit/functions'
import {
  attachImageInputSchema,
  createCampaignFileUploadIntentInputSchema,
  createImageUploadIntentInputSchema,
  createImageUploadIntentOutputSchema,
  createVttMapUploadIntentInputSchema,
  createVttMapUploadIntentOutputSchema,
  finalizeImageUploadInputSchema,
  finalizeImageUploadOutputSchema,
  finalizeVttMapUploadOutputSchema,
  imageLookupInputSchema,
  removeImageInputSchema,
  signedImageDeliveryDtoSchema,
  signedVttMapDeliveryDtoSchema
} from '@artificer-toolkit/schema/api/media'
import { requireUserId, withAuthenticatedDb, withDb } from './dbContext.js'

import { authenticatedProcedure, createTRPCRouter, okResponseSchema } from './procedures.js'

export const mediaRouter = createTRPCRouter({
  createCampaignFileUpload: authenticatedProcedure
    .input(createCampaignFileUploadIntentInputSchema)
    .output(createImageUploadIntentOutputSchema)
    .mutation(({ ctx, input }) => {
      const userId = requireUserId(ctx)
      return withDb(ctx, (db) => createCampaignFileUploadIntent(db, userId, input))
    }),
  finalizeCampaignFileUpload: authenticatedProcedure
    .input(finalizeImageUploadInputSchema)
    .output(finalizeImageUploadOutputSchema)
    .mutation(({ ctx, input }) => {
      const userId = requireUserId(ctx)
      return withDb(ctx, (db) => finalizeCampaignFileUpload(db, userId, input.assetId))
    }),
  createVttMapUpload: authenticatedProcedure
    .input(createVttMapUploadIntentInputSchema)
    .output(createVttMapUploadIntentOutputSchema)
    .mutation(({ ctx, input }) => {
      const userId = requireUserId(ctx)
      return withDb(ctx, (db) => createVttMapUploadIntent(db, userId, input))
    }),
  finalizeVttMapUpload: authenticatedProcedure
    .input(finalizeImageUploadInputSchema)
    .output(finalizeVttMapUploadOutputSchema)
    .mutation(({ ctx, input }) => {
      const userId = requireUserId(ctx)
      return withDb(ctx, (db) => finalizeVttMapUpload(db, userId, input.assetId))
    }),
  getVttMapDelivery: authenticatedProcedure
    .input(finalizeImageUploadInputSchema)
    .output(signedVttMapDeliveryDtoSchema)
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, (db, userId) => getVttMapDelivery(db, userId, input.assetId))
    ),
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
