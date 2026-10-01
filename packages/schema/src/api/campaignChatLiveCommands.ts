import { z, lazySchema } from '../zod.js'
import {
  executeCampaignRollInputSchema,
  sendCampaignChatEntryInputSchema
} from './campaignCommunication.js'
import { uuidSchema } from './campaignContractSchemas.js'

/**
 * Chat and Campaign rolls the live room executes while it holds authority (D69). The command ID is
 * the entry's client nonce, so the journal's exact-retry replay is the nonce replay.
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
      })
    ])
    .check(
      z.superRefine((command, context) => {
        if (command.commandId.toLowerCase() !== command.input.clientNonce.toLowerCase())
          context.addIssue({
            code: 'custom',
            path: ['input', 'clientNonce'],
            message: 'The command ID is the chat client nonce.'
          })
      })
    )
)

export type CampaignChatLiveCommand = z.infer<typeof campaignChatLiveCommandSchema>
