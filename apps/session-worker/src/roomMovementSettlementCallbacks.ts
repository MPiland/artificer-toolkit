import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type {
  EncounterCharacterWriteTransaction,
  EncounterWritePorts
} from '@artificer-toolkit/encounter-persistence/ports'
import type { persistMovementContacts } from '@artificer-toolkit/encounter-persistence/movementSettlementPersistence'
import { endHolderStateGrants } from '@artificer-toolkit/encounter-persistence/concentrationEnd'
import { persistLiveMovementSpatial } from '@artificer-toolkit/encounter-persistence/liveMovementSpatialPersistence'
import { persistLiveMovementReaction } from '@artificer-toolkit/encounter-persistence/liveMovementReactionPersistence'
import {
  persistLiveMovementConcentration,
  persistLiveMovementConcentrationEnd
} from '@artificer-toolkit/encounter-persistence/liveMovementConcentrationPersistence'
import {
  persistLiveMovementAreaDeparture,
  persistLiveMovementMoveEnd
} from '@artificer-toolkit/encounter-persistence/escapedEffectEndPersistence'
import {
  readLiveCharacterStreamVersion,
  readLiveMovementTargetState
} from '@artificer-toolkit/encounter-persistence/liveMovementTargetState'
import { applyLiveConcentrationCleanup } from '@artificer-toolkit/encounter-persistence/concentrationCleanupPersistence'
import { readRunActors } from '@artificer-toolkit/encounter-persistence/documents'
import { settleDamageMirrors } from './roomDamageMirror.js'
import { applyRoomEncounterMechanicsBatch } from './roomEncounterMechanics.js'
import { readRoomSceneState } from './roomSceneRead.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

/** What the room's movement contact callbacks write through: Characters, chat and Concentration rolls. */
export type MovementSettlementContext = EncounterCharacterWriteTransaction & {
  readonly ports: Pick<EncounterWritePorts, 'postRulesChatMessage' | 'recordConcentrationCheckRoll'>
}

/**
 * The room's persistence of each kind of movement contact (voluntary moves and the forced moves an
 * action carries settle through the same callbacks); `characterIds` are the Characters the contact
 * may read.
 */
export function roomMovementSettlementCallbacks(input: {
  ctx: MovementSettlementContext
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  campaignId: string
  epoch: string
  observed: LiveSessionRulesRevisions
  characterIds: ReadonlySet<string>
  /** Set by a voluntary move, whose command settles the damage mirrors its contacts collect. */
  mirrorSettlement?: { userId: string; random(maximum: number): number }
}): Parameters<typeof persistMovementContacts>[2] {
  const { ctx, store, transaction, inputs, campaignId, epoch, observed, characterIds } = input
  const readCampaignCharacterState = async (id: string, characterId: string) => {
    if (id !== campaignId || !characterIds.has(characterId))
      throw new Error('Movement Character state is outside the captured scope.')
    const part = await inputs.character(characterId, observed, transaction)
    if (!part.inputs || part.inputs.campaign.id !== id || part.inputs.owner.id !== characterId)
      throw new Error('Room movement Character state is unavailable.')
    return { state: part.inputs.campaign.state }
  }
  const applyMechanics: Parameters<typeof persistLiveMovementSpatial>[2]['applyMechanics'] = (
    batch
  ) =>
    applyRoomEncounterMechanicsBatch({
      ctx,
      store,
      transaction,
      inputs,
      campaignId,
      epoch,
      observed,
      batch
    })
  const concentrationCallbacks = {
    applyCleanup: (cleanup: Parameters<typeof applyLiveConcentrationCleanup>[1]) =>
      applyLiveConcentrationCleanup(ctx, cleanup),
    currentCharacterStreamVersion: (state: EncounterRunState, id: string) =>
      readLiveCharacterStreamVersion(ctx, state, id),
    readTargetState: (state: EncounterRunState, actor: EncounterRunActorState, maximum: number) =>
      readLiveMovementTargetState(ctx, state, actor, maximum, readCampaignCharacterState)
  }
  // A voluntary move is no Encounter command, so its contacts pass on the damage they dealt a mirror's
  // holder here, and the actors the step hands the next one are the post-mirror rows. A forced move
  // an action carries settles in that action's own command instead.
  const withSettledMirrors = async (state: EncounterRunState, actors: EncounterRunActorState[]) => {
    if (!input.mirrorSettlement) return actors
    const landed = await settleDamageMirrors({
      ctx,
      store,
      transaction,
      inputs,
      campaignId,
      epoch,
      observed,
      encounterId: state.id,
      ...input.mirrorSettlement
    })
    if (!landed) return actors
    const fresh = await readRunActors(ctx, state)
    return actors.map((actor) => fresh.find(({ id }) => id === actor.id) ?? actor)
  }
  return {
    persistSpatial: async (step) => {
      const committed = await persistLiveMovementSpatial(ctx, step, {
        applyMechanics,
        readCampaignCharacterState
      })
      return { ...committed, actors: await withSettledMirrors(step.state, committed.actors) }
    },
    persistReaction: async (step) =>
      withSettledMirrors(
        step.state,
        await persistLiveMovementReaction(ctx, step, {
          applyMechanics,
          readCampaignCharacterState,
          readSceneTokens: async (sceneId) =>
            (await readRoomSceneState(transaction, sceneId)).scene.tokens
        })
      ),
    persistConcentration: (step) =>
      persistLiveMovementConcentration(ctx, step, concentrationCallbacks),
    persistConcentrationEnd: (step) =>
      persistLiveMovementConcentrationEnd(ctx, step, concentrationCallbacks),
    persistAreaDeparture: (step) => persistLiveMovementAreaDeparture(ctx, step),
    persistMoveEnd: (step) => persistLiveMovementMoveEnd(ctx, step),
    endHolderGrants: (step) => endHolderStateGrants(ctx, step)
  }
}
