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

/** Masks a stored roll's labels for the viewer's content maturity; its evidence is untouched. */
function presentRoll(roll: StoredEntry['rolls'][number]['roll'], maturity: 'STANDARD' | 'MATURE') {
  return {
    ...roll,
    characterLabel: presentCampaignPlainText(roll.characterLabel, maturity),
    source: {
      ...roll.source,
      label: presentCampaignPlainText(roll.source.label, maturity).slice(0, 80)
    },
    ...(roll.ruleCheck?.kind === 'CONCENTRATION'
      ? {
          ruleCheck: {
            ...roll.ruleCheck,
            actorLabel: presentCampaignPlainText(roll.ruleCheck.actorLabel, maturity).slice(0, 160),
            sourceLabel:
              roll.ruleCheck.sourceLabel === null
                ? null
                : presentCampaignPlainText(roll.ruleCheck.sourceLabel, maturity).slice(0, 160)
          }
        }
      : roll.ruleCheck?.kind === 'D20_MODE_ADJUSTED'
        ? {
            ruleCheck: {
              ...roll.ruleCheck,
              caption:
                roll.ruleCheck.caption === null
                  ? null
                  : presentCampaignPlainText(roll.ruleCheck.caption, maturity).slice(0, 160)
            }
          }
        : roll.ruleCheck?.kind === 'D20_MINIMUM_ROLL'
          ? {
              ruleCheck: {
                ...roll.ruleCheck,
                label: presentCampaignPlainText(roll.ruleCheck.label, maturity).slice(0, 160)
              }
            }
          : roll.ruleCheck?.kind === 'SAVE_AUTO_FAIL'
            ? {
                ruleCheck: {
                  ...roll.ruleCheck,
                  labels: roll.ruleCheck.labels.map((label) =>
                    presentCampaignPlainText(label, maturity).slice(0, 160)
                  )
                }
              }
            : {})
  }
}

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
      rolls: entry.rolls.map(({ roll, revealedByGm }) => ({
        roll: presentRoll(roll, maturity),
        revealedByGm
      })),
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
