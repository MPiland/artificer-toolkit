import type { DBLike, EncounterRecord } from '@artificer-toolkit/db'
import type { LiveSessionCommandAuthority } from '../campaign/liveSessionCommandAuthority.js'
import {
  checksumCampaignCharacterMechanicalContext,
  resolveCharacterLiveSessionRuleContext,
  type CharacterSheetCampaignContext
} from '../character/campaignCharacterSheet.js'
import type { LockedEncounterCharacterUnequipCapability } from '../character/sheetService.js'
import type { LockedEncounterActiveEffectTargets } from './encounterActiveEffectTargetState.js'
import { EncounterConflictError } from './encounterErrors.js'

export interface LockedEncounterCharacterOptionalContestContext {
  readonly targetActorId: string
  readonly targetCharacterId: string
  readonly targetStreamVersion: number
  readonly targetMechanicsProjectionChecksum: string
  readonly targetCampaignOverlayChecksum: string
  readonly effectiveSize: string | null
  readonly checkTotals: Readonly<Record<string, number>>
  readonly selectedItem: {
    readonly equipmentDefinitionId: string
    readonly itemId: string
    readonly properties: readonly string[]
    readonly state: 'EQUIPPED'
  }
  /** Server-only and valid only while the enclosing Encounter lock callback is executing. */
  readonly unequipCapability: LockedEncounterCharacterUnequipCapability
}

function requireLockedTarget(input: {
  encounter: Pick<EncounterRecord, 'actors' | 'campaignId'>
  targetActorId: string
  targets: LockedEncounterActiveEffectTargets
}) {
  const encounterActor = input.encounter.actors.find((actor) => actor.id === input.targetActorId)
  if (
    !encounterActor ||
    encounterActor.kind !== 'CHARACTER' ||
    !encounterActor.sourceId ||
    encounterActor.sourceRevision === null
  ) {
    throw new EncounterConflictError('The optional combat Character target is unavailable.')
  }
  const locked = input.targets.lockedCharacters.get(encounterActor.sourceId)
  if (
    !locked ||
    locked.id !== encounterActor.sourceId ||
    locked.actor.id !== encounterActor.id ||
    locked.actor.kind !== 'CHARACTER' ||
    locked.actor.sourceId !== encounterActor.sourceId ||
    locked.actor.sourceRevision !== encounterActor.sourceRevision ||
    locked.actor.systemId !== encounterActor.systemId ||
    locked.streamVersion !== encounterActor.sourceRevision ||
    locked.mechanics.characterStreamVersion !== locked.streamVersion
  ) {
    throw new EncounterConflictError('The optional combat Character target is stale.')
  }
  return { encounterActor, locked }
}

function requireEquippedItem(input: {
  itemId: string
  locked: ReturnType<typeof requireLockedTarget>['locked']
}) {
  const equipped = input.locked.mechanics.commandState.state.equipment.equipped.includes(
    input.itemId
  )
  const item = input.locked.mechanics.initiativeActorFacts.equippedItems.find(
    (candidate) => candidate.itemInstanceId === input.itemId
  )
  if (!equipped || !item) {
    throw new EncounterConflictError('The selected Character item is no longer equipped.')
  }
  return item
}

/**
 * Builds target-owned, source-neutral facts after the established Encounter
 * command context and active-effect target locks are already held.  The
 * capability is intentionally scoped to this callback so it cannot be
 * returned through transport or used after the canonical lock lane ends.
 */
export async function withLockedEncounterCharacterOptionalContestContext<T>(
  input: {
    actorUserId: string
    attunementSlotOverride: number | null
    commandId: string
    db: DBLike
    encounter: Pick<EncounterRecord, 'actors' | 'campaignId'> & { id: string }
    liveSessionAuthority?: LiveSessionCommandAuthority
    occurrenceId: string
    selectedItemId: string
    sourceCommandId: string
    targetActorId: string
    targets: LockedEncounterActiveEffectTargets
  },
  run: (context: LockedEncounterCharacterOptionalContestContext) => Promise<T>
): Promise<T> {
  const { encounterActor, locked } = requireLockedTarget(input)
  const selectedItem = requireEquippedItem({ itemId: input.selectedItemId, locked })
  const liveRuleContext = await resolveCharacterLiveSessionRuleContext(input.db, locked.id, {
    id: input.encounter.campaignId,
    attunementSlotOverride: input.attunementSlotOverride
  })
  if (!liveRuleContext) {
    throw new EncounterConflictError('The optional combat Character assignment is stale.')
  }
  const campaignContext: CharacterSheetCampaignContext = {
    viewer: 'CAMPAIGN_OWNER',
    campaignId: input.encounter.campaignId,
    campaignStatus: 'ACTIVE',
    contentMaturity: null,
    attunementSlotOverride: liveRuleContext.attunementSlotOverride,
    adjustments: liveRuleContext.adjustments,
    secretAdjustmentIds: new Set(),
    // This internal UNEQUIP lane never returns a Sheet projection.  Conditions
    // are presentation-only here; mechanical overlay currentness is verified
    // from the locked adjustment checksum below.
    conditions: []
  }
  if (
    checksumCampaignCharacterMechanicalContext({
      adjustments: campaignContext.adjustments,
      attunementSlotOverride: campaignContext.attunementSlotOverride
    }) !== locked.overlay.mechanicalContextChecksum
  ) {
    throw new EncounterConflictError('The optional combat Character overlay is stale.')
  }
  return run({
    targetActorId: encounterActor.id,
    targetCharacterId: locked.id,
    targetStreamVersion: locked.streamVersion,
    targetMechanicsProjectionChecksum: locked.mechanics.projectionChecksum,
    targetCampaignOverlayChecksum: locked.overlay.projectionChecksum,
    effectiveSize: locked.mechanics.initiativeActorFacts.effectiveSize,
    checkTotals: locked.mechanics.initiativeActorFacts.checkTotals,
    selectedItem: {
      itemId: selectedItem.itemInstanceId,
      equipmentDefinitionId: selectedItem.equipmentDefinitionId,
      properties: selectedItem.properties,
      state: 'EQUIPPED'
    },
    unequipCapability: {
      encounterId: input.encounter.id,
      campaignId: input.encounter.campaignId,
      characterId: locked.id,
      actorUserId: input.actorUserId,
      ...(input.liveSessionAuthority ? { liveSessionAuthority: input.liveSessionAuthority } : {}),
      expectedCharacterStreamVersion: locked.streamVersion,
      expectedMechanicsProjectionChecksum: locked.mechanics.projectionChecksum,
      expectedCampaignOverlayChecksum: locked.overlay.projectionChecksum,
      commandId: input.commandId,
      sourceCommandId: input.sourceCommandId,
      occurrenceId: input.occurrenceId,
      command: {
        type: 'UNEQUIP_ITEM',
        commandId: input.commandId,
        expectedVersion: locked.streamVersion,
        itemId: selectedItem.itemInstanceId
      },
      campaignContext
    }
  })
}
