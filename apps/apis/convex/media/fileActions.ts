'use node'

import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  finalizeImageUploadInputSchema,
  finalizeImageUploadOutputSchema,
  signedCampaignFileDeliveryDtoSchema,
  type FinalizeImageUploadOutput,
  type SignedCampaignFileDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import { getCampaignAttachmentDeliveryInputSchema } from '@artificer-toolkit/schema/api/campaignAttachments'
import type {
  CampaignFileProcessClaim,
  CampaignFileDeliverySource
} from '@artificer-toolkit/schema/projections/campaignFilePersistence'
import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { processCampaignFileClaim } from './fileProcessing'
import { MediaValidationError } from './processing'
import { createMediaStorage } from './storage'

export const finalize = action({
  args: zodToConvexFields(finalizeImageUploadInputSchema.shape),
  returns: zodToConvex(finalizeImageUploadOutputSchema),
  handler: async (ctx, args): Promise<FinalizeImageUploadOutput> => {
    const claim: CampaignFileProcessClaim = await ctx.runMutation(
      internal.media.fileAssets.beginFinalize,
      finalizeImageUploadInputSchema.parse(args)
    )
    if (claim.kind === 'CURRENT') return claim.result
    const operation = { assetId: claim.asset.id, operationId: claim.operation.id }
    try {
      const processed = await processCampaignFileClaim(ctx, claim.asset, claim.operation)
      return await ctx.runMutation(internal.media.fileAssets.finishFinalize, {
        ...operation,
        ...processed
      })
    } catch (error) {
      if (error instanceof MediaValidationError) {
        await ctx.runMutation(internal.media.fileAssets.rejectFinalize, operation)
        return { assetId: claim.asset.id, status: 'REJECTED', preview: null }
      }
      await ctx.runMutation(internal.media.assets.failSave, operation)
      throw new Error('Could not finalize the file. Try again.')
    }
  }
})

export const getDelivery = action({
  args: zodToConvexFields(getCampaignAttachmentDeliveryInputSchema.shape),
  returns: zodToConvex(signedCampaignFileDeliveryDtoSchema),
  handler: async (ctx, args): Promise<SignedCampaignFileDeliveryDto> => {
    const source: CampaignFileDeliverySource = await ctx.runQuery(
      internal.campaigns.attachments.readDelivery,
      getCampaignAttachmentDeliveryInputSchema.parse(args)
    )
    try {
      const storage = createMediaStorage()
      // Sign the download disposition too; encoding keeps filenames out of header syntax.
      const fileName = encodeURIComponent(source.fileName).replace(
        /[!'()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
      )
      const expiresAt = new Date(Date.now() + 300_000).toISOString()
      const url = await getSignedUrl(
        storage.client,
        new GetObjectCommand({
          Bucket: storage.config.bucket,
          Key: source.objectKey,
          ResponseContentDisposition: `attachment; filename*=UTF-8''${fileName}`,
          ResponseContentType: source.mimeType
        }),
        { expiresIn: 300 }
      )
      return signedCampaignFileDeliveryDtoSchema.parse({
        assetId: source.assetId,
        url,
        expiresAt,
        mimeType: source.mimeType,
        fileName: source.fileName,
        byteSize: source.byteSize
      })
    } catch {
      throw new Error('Could not create the file download. Try again.')
    }
  }
})
