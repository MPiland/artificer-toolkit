import { v } from 'convex/values'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { liveSessionEncounterBasicActionCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import { persistEncounterBasicAction } from '@artificer-toolkit/encounter-persistence/basicActionPersistence'
import { internalMutation } from '../lib/mutations'
import { readDefinitionRoot } from '../content/definitionStore'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterBasicActionCommitInputSchema.parse(args)
    return persistEncounterBasicAction(encounterWriteTransaction(ctx), input, {
      validateReadFence: (state, actors, input) =>
        assertLiveSessionRulesRevisions(ctx, input.revisions, {
          systemId: state.gameSystemId,
          campaignId: state.campaignId,
          characterIds: actors.flatMap((actor) =>
            actor.kind === 'CHARACTER' ? [actor.sourceId] : []
          )
        }),
      readDefinition: async (id, userId) => {
        const root = await readDefinitionRoot(ctx, id, userId)
        return root?.sourceKind === 'PLATFORM' ? root.current : null
      }
    })
  }
})
