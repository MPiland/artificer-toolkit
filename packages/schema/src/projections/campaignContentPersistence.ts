import { z, lazySchema } from '../zod.js'
import { campaignContentShareDtoSchema } from '../api/campaignCore.js'
import { uuidSchema } from '../api/campaignContractSchemas.js'
import { authoredSubjectKindSchema } from './identity.js'

/** A direct root grant, never a copied publication or permission over an entire source. */
export const campaignStoredContentShareSchema = lazySchema(() =>
  z.extend(z.omit(campaignContentShareDtoSchema, { document: true }), { campaignId: uuidSchema })
)

/**
 * One Character's reconcile, queued by the transaction that changed its Campaign authority (ADR
 * 0013): an unshare or a departing member's shares (`removed`, under `removalEventId`), or the
 * Character's own departure (`departed`). `stepId` becomes the reconcile event's `commandId`, so a
 * duplicate step finds it and does nothing.
 */
export const campaignCharacterReconcileStepSchema = lazySchema(() =>
  z.object({
    stepId: uuidSchema,
    campaignId: uuidSchema,
    characterId: uuidSchema,
    actorUserId: uuidSchema,
    reason: z.enum([
      'UNSHARE',
      'MEMBER_LEFT',
      'MEMBER_REMOVED',
      'CHARACTER_REPLACED',
      'CHARACTER_UNASSIGNED',
      'CHARACTER_DELETED',
      'CAMPAIGN_DELETED'
    ]),
    persistedContextChange: z.boolean(),
    change: z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('SOURCES_REMOVED'),
        removalEventId: uuidSchema,
        removed: z.array(
          z.object({ subjectKind: authoredSubjectKindSchema, subjectId: uuidSchema })
        )
      }),
      z.object({ kind: z.literal('DEPARTED') })
    ])
  })
)
export type CampaignCharacterReconcileStep = z.infer<typeof campaignCharacterReconcileStepSchema>
