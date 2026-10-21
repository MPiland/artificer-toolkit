import type { EncounterCharacterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { EncounterCharacterRow } from '@artificer-toolkit/encounter-persistence/characterPlay'
import {
  readEncounterMechanicsBatchTarget,
  persistEncounterMechanicsBatchPlan,
  type EncounterMechanicsBatchResult
} from '@artificer-toolkit/encounter-persistence/mechanicsBatchPersistence'
import {
  planEncounterMechanicsBatch,
  type EncounterMechanicsBatchInput
} from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { readCharacterMaximumHitPoints } from '@artificer-toolkit/encounter-persistence/characterMaximumHitPoints'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import {
  heldBatchInputs,
  heldDamageInterceptions
} from '@artificer-toolkit/rules-runtime/encounterDamageInterception'
import { buildMovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { withRecordedInterceptionSaveRolls } from '@artificer-toolkit/rules-runtime/encounterInterceptionSaveRolls'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'

/** Applies the existing mechanics plan and receipts inside the admitted room command transaction. */
export async function applyRoomEncounterMechanicsBatch(input: {
  ctx: EncounterCharacterWriteTransaction
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  campaignId: string
  epoch: string
  observed: LiveSessionRulesRevisions
  batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
}): Promise<EncounterMechanicsBatchResult> {
  const { ctx, store, transaction, inputs, campaignId, epoch, observed, batch } = input
  const read = await readEncounterMechanicsBatchTarget(ctx, {
    ...batch,
    expectedCharacterStreamVersion: null
  })
  if (read.campaign.id !== campaignId || store.epoch !== epoch)
    throw new Error('Room mechanics Campaign authority changed.')
  let character: EncounterCharacterRow | null = null
  let characterFacts: Parameters<typeof planEncounterMechanicsBatch>[0]['characterFacts']
  if (read.actor.kind === 'CHARACTER') {
    const { assignment } = await ctx.ports.requireCampaignCharacterAuthority(
      campaignId,
      read.actor.sourceId,
      read.campaign.ownerUserId
    )
    const facts = await prepareRoomLiveCharacterSheet(
      store,
      inputs,
      {
        campaignId,
        authorityEpoch: epoch,
        characterId: read.actor.sourceId,
        expectedUserId: read.campaign.ownerUserId,
        expectedRole: 'OWNER'
      },
      observed,
      transaction
    )
    character = await ctx.ports.readCharacterRow(facts.active.id)
    if (
      !character ||
      character._id !== facts.active._id ||
      character.play.streamVersion !== facts.active.play.streamVersion ||
      character.play.checksum !== facts.active.play.checksum ||
      character.id !== read.actor.sourceId ||
      character.systemId !== read.actor.systemId ||
      character.systemId !== read.campaign.gameSystemId ||
      character.userId !== assignment.userId ||
      character.status !== 'ACTIVE'
    )
      throw new Error('Room mechanics Character identity is stale.')
    characterFacts = {
      active: character,
      character: facts.character,
      sheetState: facts.sheetState,
      campaignContext: facts.campaignContext
    }
  }
  // A Character in a form takes hits on the form's pool; the Sheet maximum is where excess damage
  // lands, so callers' maxima (a Sheet's for a source, the form's for a target) are replaced (D130).
  const form = read.actor.kind === 'CHARACTER' ? read.actor.form : null
  // The commit applies receipt applications that persistence builders assemble without the target's
  // held effects, so the room derives the batch inputs they imply here, once, for every caller.
  const heldEffects = await listActiveRuleEffects(ctx, turnEffectOwner(read.actor, read.state.id), {
    ownerVerified: true
  })
  const heldInputs =
    character && form
      ? {
          ...heldBatchInputs({ baseMaximumHitPoints: form.maxHitPoints, effects: heldEffects }),
          sheetMaximumHitPoints: await readCharacterMaximumHitPoints(ctx, character.play)
        }
      : {
          damageInterceptions:
            read.actor.kind === 'CREATURE'
              ? withRecordedInterceptionSaveRolls(
                  buildMovementTarget({
                    actor: read.actor,
                    activeEffects: heldEffects,
                    gameSystemId: read.campaign.gameSystemId,
                    campaignId,
                    characterFacts: null
                  }).damageInterceptions,
                  batch.applications
                )
              : heldDamageInterceptions(heldEffects)
        }
  const target = {
    ...read,
    input: {
      ...read.input,
      ...heldInputs,
      expectedCharacterStreamVersion: character?.play.streamVersion ?? null
    }
  }
  const plan = planEncounterMechanicsBatch({
    batch: target.input,
    actor: read.actor,
    userId: read.userId,
    characterFacts
  })
  return persistEncounterMechanicsBatchPlan(ctx, target, { actor: read.actor, character, plan })
}
