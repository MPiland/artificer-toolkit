import {
  campaignChatEntryDtoSchema,
  type CampaignChatEntryDto
} from '@artificer-toolkit/schema/api/campaignCommunication'
import type {
  campaignStoredConversationSchema,
  campaignStoredEntryIdentitySchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'

type StoredEntry = {
  header: Pick<
    ReturnType<typeof campaignStoredEntryIdentitySchema.parse>,
    'id' | 'campaignId' | 'conversationId' | 'authorUserId' | 'createdAt'
  >
  payload: ReturnType<typeof campaignStoredEntryPayloadSchema.parse>
}

/** Presents retained entry snapshots with their resolved author labels. */
export function presentChatEntries(
  entries: readonly StoredEntry[],
  conversation: Pick<ReturnType<typeof campaignStoredConversationSchema.parse>, 'kind'>,
  maturity: 'STANDARD' | 'MATURE',
  authorUsernames: readonly string[]
): CampaignChatEntryDto[] {
  return entries.map(({ header: entry, payload }, index) =>
    campaignChatEntryDtoSchema.parse({
      id: entry.id,
      campaignId: entry.campaignId,
      conversationId: entry.conversationId,
      room: conversation.kind,
      kind: payload.kind,
      mode: payload.mode,
      // Masking can expand a short word; bound display text without changing stored snapshots.
      body:
        payload.body === null
          ? null
          : presentCampaignPlainText(payload.body, maturity).slice(0, 2000),
      roll:
        payload.roll === null
          ? null
          : {
              ...payload.roll,
              characterLabel: presentCampaignPlainText(payload.roll.characterLabel, maturity),
              source: {
                ...payload.roll.source,
                label: presentCampaignPlainText(payload.roll.source.label, maturity).slice(0, 80)
              },
              ...(payload.roll.ruleCheck?.kind === 'CONCENTRATION'
                ? {
                    ruleCheck: {
                      ...payload.roll.ruleCheck,
                      actorLabel: presentCampaignPlainText(
                        payload.roll.ruleCheck.actorLabel,
                        maturity
                      ).slice(0, 160),
                      sourceLabel:
                        payload.roll.ruleCheck.sourceLabel === null
                          ? null
                          : presentCampaignPlainText(
                              payload.roll.ruleCheck.sourceLabel,
                              maturity
                            ).slice(0, 160)
                    }
                  }
                : payload.roll.ruleCheck?.kind === 'D20_MODE_ADJUSTED'
                  ? {
                      ruleCheck: {
                        ...payload.roll.ruleCheck,
                        caption:
                          payload.roll.ruleCheck.caption === null
                            ? null
                            : presentCampaignPlainText(
                                payload.roll.ruleCheck.caption,
                                maturity
                              ).slice(0, 160)
                      }
                    }
                  : payload.roll.ruleCheck?.kind === 'D20_MINIMUM_ROLL'
                    ? {
                        ruleCheck: {
                          ...payload.roll.ruleCheck,
                          label: presentCampaignPlainText(
                            payload.roll.ruleCheck.label,
                            maturity
                          ).slice(0, 160)
                        }
                      }
                    : payload.roll.ruleCheck?.kind === 'SAVE_AUTO_FAIL'
                      ? {
                          ruleCheck: {
                            ...payload.roll.ruleCheck,
                            labels: payload.roll.ruleCheck.labels.map((label) =>
                              presentCampaignPlainText(label, maturity).slice(0, 160)
                            )
                          }
                        }
                      : {})
            },
      revealedByGm: payload.revealedByGm,
      authorUserId: entry.authorUserId,
      authorUsername: authorUsernames[index],
      characterId: payload.characterId,
      characterLabel:
        payload.characterLabel === null
          ? null
          : presentCampaignPlainText(payload.characterLabel, maturity).slice(0, 100),
      editedAt: payload.editedAt,
      unsentAt: payload.unsentAt,
      createdAt: entry.createdAt
    })
  )
}
