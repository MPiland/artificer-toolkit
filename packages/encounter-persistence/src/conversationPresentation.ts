import {
  campaignChatEntryDtoSchema,
  type CampaignChatEntryDto
} from '@artificer-toolkit/schema/api/campaignCommunication'
import type {
  campaignStoredConversationSchema,
  campaignStoredEntrySchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'

type StoredEntry = ReturnType<typeof campaignStoredEntrySchema.parse>

/** Presents retained entry snapshots with their resolved author labels. */
export function presentChatEntries(
  entries: readonly StoredEntry[],
  conversation: Pick<ReturnType<typeof campaignStoredConversationSchema.parse>, 'kind'>,
  maturity: 'STANDARD' | 'MATURE',
  authorUsernames: readonly string[]
): CampaignChatEntryDto[] {
  return entries.map((entry, index) =>
    campaignChatEntryDtoSchema.parse({
      id: entry.id,
      campaignId: entry.campaignId,
      conversationId: entry.conversationId,
      room: conversation.kind,
      kind: entry.kind,
      mode: entry.mode,
      // Masking can expand a short word; bound display text without changing stored snapshots.
      body:
        entry.body === null ? null : presentCampaignPlainText(entry.body, maturity).slice(0, 2000),
      roll:
        entry.roll === null
          ? null
          : {
              ...entry.roll,
              characterLabel: presentCampaignPlainText(entry.roll.characterLabel, maturity),
              source: {
                ...entry.roll.source,
                label: presentCampaignPlainText(entry.roll.source.label, maturity).slice(0, 80)
              },
              ...(entry.roll.ruleCheck?.kind === 'CONCENTRATION'
                ? {
                    ruleCheck: {
                      ...entry.roll.ruleCheck,
                      actorLabel: presentCampaignPlainText(
                        entry.roll.ruleCheck.actorLabel,
                        maturity
                      ).slice(0, 160),
                      sourceLabel:
                        entry.roll.ruleCheck.sourceLabel === null
                          ? null
                          : presentCampaignPlainText(
                              entry.roll.ruleCheck.sourceLabel,
                              maturity
                            ).slice(0, 160)
                    }
                  }
                : entry.roll.ruleCheck?.kind === 'D20_MODE_ADJUSTED'
                  ? {
                      ruleCheck: {
                        ...entry.roll.ruleCheck,
                        caption:
                          entry.roll.ruleCheck.caption === null
                            ? null
                            : presentCampaignPlainText(
                                entry.roll.ruleCheck.caption,
                                maturity
                              ).slice(0, 160)
                      }
                    }
                  : entry.roll.ruleCheck?.kind === 'D20_MINIMUM_ROLL'
                    ? {
                        ruleCheck: {
                          ...entry.roll.ruleCheck,
                          label: presentCampaignPlainText(
                            entry.roll.ruleCheck.label,
                            maturity
                          ).slice(0, 160)
                        }
                      }
                    : entry.roll.ruleCheck?.kind === 'SAVE_AUTO_FAIL'
                      ? {
                          ruleCheck: {
                            ...entry.roll.ruleCheck,
                            labels: entry.roll.ruleCheck.labels.map((label) =>
                              presentCampaignPlainText(label, maturity).slice(0, 160)
                            )
                          }
                        }
                      : {})
            },
      revealedByGm: entry.revealedByGm,
      authorUserId: entry.authorUserId,
      authorUsername: authorUsernames[index],
      characterId: entry.characterId,
      characterLabel:
        entry.characterLabel === null
          ? null
          : presentCampaignPlainText(entry.characterLabel, maturity).slice(0, 100),
      editedAt: entry.editedAt,
      unsentAt: entry.unsentAt,
      createdAt: entry.createdAt
    })
  )
}
