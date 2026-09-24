import {
  createEncounterInitiativeDeclarationRequest as createInitiativeDeclarationRequest,
  compileEncounterInitiativeDeclaration as compileInitiativeDeclaration
} from '@artificer-toolkit/rules-runtime/encounterInitiativeDeclarationCompiler'
import { prepareEncounterInitiativeDeclarationSources } from '@artificer-toolkit/rules-runtime/encounterInitiativeDeclarationSources'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { MutationCtx } from '../_generated/server'
import { readCharacterPublication } from '../characters/context'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readAuthoredVersion } from '../content/documents'
import { requireSystem } from '../content/systemDocuments'
import { readRunActors } from './documents'
import type { MovementTarget } from './movementTargets'

export { createInitiativeDeclarationRequest, compileInitiativeDeclaration }

/** Locks current native declaration sources through authorized Sheet and publication reads. */
export async function loadInitiativeDeclarationSources(
  ctx: MutationCtx,
  state: EncounterRunState,
  campaign: { id: string; ownerUserId: string },
  stagedActors?: readonly EncounterRunActorState[],
  stagedMovementTargets?: ReadonlyMap<string, MovementTarget>
) {
  const [actors, system] = await Promise.all([
    stagedActors ?? readRunActors(ctx, state),
    requireSystem(ctx, state.gameSystemId)
  ])
  return prepareEncounterInitiativeDeclarationSources({
    state,
    campaignId: campaign.id,
    actors,
    system,
    loadCharacter: (actor) => {
      if (!actor.sourceId) throw new Error('Character initiative source is incomplete.')
      const staged = stagedMovementTargets?.get(actor.id)
      if (staged) {
        const facts = staged.characterFacts
        if (
          staged.actor.id !== actor.id ||
          !facts ||
          facts.active.id !== actor.sourceId ||
          facts.active.streamVersion !== actor.sourceRevision ||
          facts.character.systemId !== state.gameSystemId
        )
          throw new Error('Encounter Character source is stale.')
        return Promise.resolve(facts)
      }
      return loadCharacterSheetFacts(ctx, campaign.ownerUserId, actor.sourceId, campaign.id)
    },
    readPublishedSpell: async (spellId, facts) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', spellId))
        .unique()
      if (!root || root.subjectKind !== 'SPELL')
        throw new Error('The declared spell source is unavailable.')
      const publication = await readCharacterPublication(
        ctx,
        root,
        state.gameSystemId,
        facts.active.userId,
        facts.prepared.context.sourceAccess
      )
      const version = await readAuthoredVersion(ctx, root)
      return { publication, version }
    }
  })
}
