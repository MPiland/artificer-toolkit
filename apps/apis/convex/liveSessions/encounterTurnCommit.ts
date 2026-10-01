import { v } from 'convex/values'
import { liveSessionEncounterTurnCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { persistEncounterTurnCommit } from '@artificer-toolkit/encounter-persistence/turnCommitPersistence'
import { internalMutation } from '../lib/mutations'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { assertLiveTurnRevisions } from './encounterTurnAdmission'
import { applyLiveEncounterMechanicsBatch } from './encounterActionMechanics'
import { readDefinitionRoot } from '../content/definitionStore'
import {
  bindLiveConcentrationApplications,
  persistLiveEncounterConcentrationChildren
} from './encounterConcentrationChildrenCommit'

/** Commits a DO-computed turn in one transaction, using the native normalized writes and receipts. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterTurnCommitInputSchema.parse(args)
    return persistEncounterTurnCommit(encounterWriteTransaction(ctx), input, {
      validateReadFence: (state, actors, fencedInput, maintenanceOwners) =>
        assertLiveTurnRevisions(ctx, state, actors, fencedInput, maintenanceOwners),
      applyMechanics: (batch) => applyLiveEncounterMechanicsBatch(ctx, batch),
      readDefinition: async (id, userId) =>
        (await readDefinitionRoot(ctx, id, userId))?.current ?? null,
      bindConcentrationApplications: (state, applications) =>
        bindLiveConcentrationApplications(ctx, state, applications),
      persistConcentrationChildren: (children) =>
        persistLiveEncounterConcentrationChildren(ctx, children)
    })
  }
})
