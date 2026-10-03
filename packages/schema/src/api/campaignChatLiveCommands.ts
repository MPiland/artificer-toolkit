import { z, lazySchema } from '../zod.js'
import {
  executeCampaignPrivateRollInputSchema,
  executeCampaignRollInputSchema,
  revealCampaignRollInputSchema,
  sendCampaignChatEntryInputSchema
} from './campaignCommunication.js'
import { uuidSchema } from './campaignContractSchemas.js'

/**
 * Chat and Campaign rolls the live room executes while it holds authority (D69). The command ID is
 * the entry's client nonce, so the journal's exact-retry replay is the nonce replay. A private roll
 * is the GM's (Q14): it is retained in the room, never posted, until a `REVEAL_ROLL` posts its
 * card (FULL) or only the fact that the GM rolled (NOTICE). A reveal has no nonce: its command ID
 * only keys the journal's replay, and each roll and mode reveals once.
 */
export const campaignChatLiveCommandSchema = lazySchema(() =>
  z
    .discriminatedUnion('type', [
      z.strictObject({
        type: z.literal('SEND_CHAT'),
        commandId: uuidSchema,
        input: sendCampaignChatEntryInputSchema
      }),
      z.strictObject({
        type: z.literal('EXECUTE_ROLL'),
        commandId: uuidSchema,
        input: executeCampaignRollInputSchema
      }),
      z.strictObject({
        type: z.literal('EXECUTE_PRIVATE_ROLL'),
        commandId: uuidSchema,
        input: executeCampaignPrivateRollInputSchema
      }),
      z.strictObject({
        type: z.literal('REVEAL_ROLL'),
        commandId: uuidSchema,
        input: revealCampaignRollInputSchema
      })
    ])
    .check(
      z.superRefine((command, context) => {
        if (
          'clientNonce' in command.input &&
          command.commandId.toLowerCase() !== command.input.clientNonce.toLowerCase()
        )
          context.addIssue({
            code: 'custom',
            path: ['input', 'clientNonce'],
            message: 'The command ID is the chat client nonce.'
          })
      })
    )
)

export type CampaignChatLiveCommand = z.infer<typeof campaignChatLiveCommandSchema>
