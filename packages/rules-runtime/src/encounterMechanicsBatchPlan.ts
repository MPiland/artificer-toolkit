import { v5 as uuidv5 } from 'uuid'
import { encounterActorBody } from './encounterActorBody.js'
import { withDamageTypesTaken } from './encounterDamageTypesSinceTurnStart.js'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { characterItemConsumptionPiecesMatch } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import {
  foldCharacterMechanicsApplications,
  readEncounterActorConditionState,
  targetTemporaryHitPoints,
  targetTransitionChecksum,
  type ReceiptApplications,
  type TargetState
} from './encounterCharacterMechanicsBatch.js'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type {
  EncounterRunActorState,
  EncounterRunCharacterActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { HandSlotCode } from '@artificer-toolkit/shared/core'
import type {
  CharacterItemDegradationReceiptDto,
  CharacterItemUseStateTransitionDto,
  EncounterActorItemUseStateTransitionDto,
  SourceItemDrawDto
} from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import type { CharacterRuleActionApplication } from './characterRuleActionSystemAdapter.js'
import type { CharacterResourceRestore } from './encounterInitiativeRestores.js'
import type { CharacterDeathSaves } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import type {
  NativeCharacterActionResourceConsumption,
  NativeCharacterItemConsumption,
  NativeCharacterSpellConsumption
} from './character/characterNativeActionResources.js'
import {
  drawCharacterItem,
  unequipCharacterItem,
  updateSpellSlotUsage
} from './character/sheetCommandReducer.js'
import { nextEncounterActorDefeated } from './encounterActorDefeat.js'
import {
  applyDamageInterceptions,
  interceptionChargesSpent,
  withInterceptionChargesSpent,
  type HeldDamageInterception
} from './encounterDamageInterception.js'
import {
  enterActorForm,
  enterCharacterForm,
  revertActorForm,
  type EncounterActorFormCreature
} from './encounterActorForm.js'
import { creatureConditionCapabilityRegistry } from './platformPolicyModules.js'
import {
  applyEncounterActorItemDraw,
  applyEncounterActorItemThrow,
  applyEncounterActorOptionalContestSuccess,
  readEncounterActorOptionalContestContext
} from './encounterActorOptionalContestContext.js'
import {
  withActorTemporaryHitPoints,
  withCharacterTemporaryHitPoints
} from '@artificer-toolkit/schema/shared/temporaryHitPoints'

type EncounterActor = EncounterRunActorState
// Names the Sheet usage row a Character's first interception charge spend creates, so replays agree.
const interceptionUsageNamespace = '0d6f3c8e-2b41-4f7a-9c55-7e1a4b9d3f20'
type LoadedCharacterSheetFacts = {
  active: { id: string; play: { streamVersion: number } }
  character: CharacterAuthored
  sheetState: CharacterSheetState
  campaignContext: { conditions: readonly { conditionTypeId: string }[] }
}

export type EncounterMechanicsBatchInput = {
  encounterId: string
  targetActorId: string
  expectedEncounterVersion: number
  occurrenceId: string
  sourceCommandId: string
  commandId: string
  occurredAt: string
  applications: readonly CharacterRuleActionApplication[]
  /**
   * The target's unspent damage interceptions (`heldDamageInterceptions` over its held effects), in
   * spend order. Omitted when none; whoever commits the plan spends the effects the receipt names.
   */
  damageInterceptions?: readonly HeldDamageInterception[]
  /** The Character stream version the applications were planned against; null for other actors. */
  expectedCharacterStreamVersion: number | null
  /** The maximum of the hit points the applications change: a Character in a form takes the form's. */
  effectiveMaximumHitPoints: number
  /** A Character's own effective maximum while it is in a form; its excess damage lands on the Sheet. */
  sheetMaximumHitPoints?: number | undefined
  forceVersionAdvance: boolean
  retainedConditionIds?: readonly string[]
  effectiveScalarValues?: Readonly<Record<string, number>>
  characterResourceConsumption?: NativeCharacterActionResourceConsumption
  /** The empty pools this Character's initiative restores raise; applied after any spend. */
  characterResourceRestores?: readonly CharacterResourceRestore[]
  /** A single-use item this Assisted action used up; recorded as play usage, never as a structure edit. */
  characterItemConsumption?: NativeCharacterItemConsumption
  /**
   * The slots one actor's casts spent in this terminal commit (a cast, then a counter to a Counterspell
   * against it), applied in order and recorded on the Character in the same version as the outcome.
   */
  characterSpellConsumptions?: readonly NativeCharacterSpellConsumption[]
  /** An accepted wield conflict: unequip this item in the same Character version. */
  stowEquippedItemInstanceId?: string
  /**
   * The item a hand of the target holds that it drops with this outcome (Heat Metal): a
   * Character's item is unequipped, a Creature's loadout entry carried.
   */
  releaseHeldItemInstanceId?: string
  /**
   * The worn item this outcome corrodes (`planEncounterEquipmentDegradation`): its penalty rises to
   * `afterPenalty` and, when `destroyed`, it is used up. Characters only.
   */
  degradeItem?: { itemInstanceId: string; afterPenalty: number; destroyed: boolean }
  /**
   * The carried weapon an attack draws into this hand (D107): a Character's item is equipped, a
   * Creature's loadout entry moves to the hand. The inverse of a stow, with the same exclusions.
   */
  drawHeldItem?: { itemId: string; slot: HandSlotCode }
  /**
   * The weapon an attack throws out of this hand (D107): a Character's item is unequipped, a
   * Creature's loadout entry carried. It follows a stow in one Character version.
   */
  throwHeldItem?: { itemId: string; slot: HandSlotCode }
  /** A dying Character's turn-start death save die (D96); Characters only. */
  deathSave?: { rawDie: number; addedTotal: number }
  /** The Creature form this outcome swaps the actor into, held by `effectId` (D130). */
  enterForm?: {
    effectId: string
    excessDamageCarriesOver: boolean
    retainedAbilityIds: readonly string[]
    creature: EncounterActorFormCreature
  }
}

export type EncounterMechanicsBatchPlan = {
  updatedActor: EncounterActor
  receiptApplications: ReceiptApplications
  targetTransition: {
    checksum: string
    before: TargetState
    after: TargetState
    inForm?: true
  }
  characterStreamVersion: number | null
  itemUseStateTransition: CharacterItemUseStateTransitionDto | null
  /** The item the target dropped (`releaseHeldItemInstanceId`); null when it dropped none. */
  itemReleaseTransition:
    | CharacterItemUseStateTransitionDto
    | EncounterActorItemUseStateTransitionDto
    | null
  /** The weapon the actor drew or threw (`drawHeldItem`, `throwHeldItem`); null when it moved none. */
  itemDrawTransition: SourceItemDrawDto | null
  /** The worn item the outcome corroded (`degradeItem`); null when it corroded none. */
  itemDegradationTransition: CharacterItemDegradationReceiptDto | null
  stateChanged: boolean
  shouldAdvance: boolean
  characterUpdate: {
    character: CharacterAuthored
    sheetState: LoadedCharacterSheetFacts['sheetState'] | null
  } | null
}

/** Plans a normalized mechanics batch without reading or writing persistence. */
export function planEncounterMechanicsBatch(input: {
  batch: EncounterMechanicsBatchInput
  actor: EncounterActor
  userId: string
  characterFacts?: LoadedCharacterSheetFacts
}): EncounterMechanicsBatchPlan {
  const { batch, actor, userId } = input
  if (actor.kind !== 'CHARACTER') {
    if (batch.expectedCharacterStreamVersion !== null)
      throw new Error('Encounter non-Character actors have no Character stream version.')
    if (batch.characterResourceConsumption !== undefined)
      throw new Error('Encounter non-Character actors cannot use Character resources.')
    if (batch.characterResourceRestores !== undefined)
      throw new Error('Encounter non-Character actors cannot restore Character resources.')
    if (batch.characterItemConsumption !== undefined)
      throw new Error('Encounter non-Character actors cannot use up Character items.')
    if (batch.degradeItem !== undefined)
      throw new Error('Encounter non-Character actors wear no tracked equipment.')
    if (batch.characterSpellConsumptions !== undefined)
      throw new Error('Encounter non-Character actors cannot spend Character spell slots.')
    if (batch.stowEquippedItemInstanceId !== undefined)
      throw new Error('Encounter non-Character actors cannot stow Character equipment.')
    if (batch.deathSave !== undefined)
      throw new Error('Encounter non-Character actors make no death saves.')
    if (batch.enterForm !== undefined && actor.form !== null)
      throw new Error('The actor already has a form.')
    const release = batch.releaseHeldItemInstanceId
    const releaseContext =
      release === undefined
        ? null
        : readEncounterActorOptionalContestContext({ actor, loadoutEntryId: release })
    if (release !== undefined && !releaseContext)
      throw new Error('Encounter actor item to drop is no longer held.')
    const conditions = readEncounterActorConditionState(actor.conditions ?? [])
    const folded = foldCharacterMechanicsApplications({
      targetActorId: actor.id,
      currentHitPoints: actor.currentHitPoints,
      temporaryHitPoints: actor.tempHitPoints,
      temporaryHitPointsSourceEffectId: actor.tempHitPointsSourceEffectId,
      maximumHitPoints: batch.effectiveMaximumHitPoints,
      deathSaves: null,
      conditionIds: conditions.ids,
      scalarValues: batch.effectiveScalarValues,
      retainedConditionIds: batch.retainedConditionIds,
      applications: applyDamageInterceptions({
        applications: batch.applications,
        currentHitPoints: actor.currentHitPoints,
        temporaryHitPoints: actor.tempHitPoints,
        temporaryHitPointsSourceEffectId: actor.tempHitPointsSourceEffectId,
        interceptions: batch.damageInterceptions ?? []
      }),
      ...(batch.damageInterceptions && { damageInterceptions: batch.damageInterceptions }),
      invulnerable: encounterActorBody(actor).invulnerable,
      absence: actor.absence
    })
    const nextConditions = [
      ...conditions.values.filter((value) => {
        const id =
          typeof value === 'string'
            ? value
            : typeof value === 'object' && value !== null && !Array.isArray(value)
              ? (value as { conditionTypeId?: unknown }).conditionTypeId
              : null
        return typeof id === 'string' && folded.after.conditionIds.includes(id)
      }),
      ...folded.after.conditionIds
        .filter((id) => !conditions.ids.includes(id))
        .map((conditionTypeId) => ({ conditionTypeId }))
    ]
    const updated = encounterRunActorStateSchema.parse(
      withActorTemporaryHitPoints(
        {
          ...withDamageTypesTaken(
            withInterceptionChargesSpent(actor, folded.applications),
            folded.applications,
            batch.sourceCommandId
          ),
          currentHitPoints: folded.after.currentHitPoints,
          maxHitPoints: folded.after.maximumHitPoints,
          conditions: nextConditions,
          defeated: nextEncounterActorDefeated(actor, folded.after.currentHitPoints),
          absence: folded.afterAbsence
        },
        targetTemporaryHitPoints(folded.after)
      )
    )
    // A form at 0 hit points ends instead of defeating the actor (D130); its excess damage is what
    // the damage dealt past the form's temporary and current hit points.
    const excessDamage = folded.applications.reduce(
      (sum, application) =>
        application.kind === 'DAMAGE'
          ? sum + application.resolvedAmount - application.appliedAmount
          : sum,
      0
    )
    const settled =
      updated.kind !== 'CHARACTER' && updated.form !== null && updated.currentHitPoints === 0
        ? revertActorForm(updated, excessDamage)
        : updated
    const formed =
      batch.enterForm !== undefined && settled.kind !== 'CHARACTER'
        ? enterActorForm(settled, batch.enterForm)
        : settled
    const released = releaseContext
      ? applyEncounterActorOptionalContestSuccess({ context: releaseContext, actor: formed })
      : null
    const draw = batch.drawHeldItem
    const thrown = batch.throwHeldItem
    if ((draw !== undefined || thrown !== undefined) && release !== undefined)
      throw new Error('Encounter actor cannot draw or throw and drop items in one change.')
    if (draw !== undefined && thrown !== undefined)
      throw new Error('Encounter actor cannot draw and throw in one change.')
    const drawn = draw
      ? applyEncounterActorItemDraw({ actor: formed, loadoutEntryId: draw.itemId, slot: draw.slot })
      : null
    const thrownOut = thrown
      ? applyEncounterActorItemThrow({ actor: formed, loadoutEntryId: thrown.itemId })
      : null
    const handMoved = drawn ?? thrownOut
    const handMove = draw ?? thrown
    const changedActor = released?.actor ?? handMoved?.actor
    return {
      updatedActor: changedActor ? encounterRunActorStateSchema.parse(changedActor) : formed,
      receiptApplications: folded.applications,
      targetTransition: transition(actor.id, folded),
      characterStreamVersion: null,
      itemUseStateTransition: null,
      itemDegradationTransition: null,
      itemReleaseTransition:
        released && releaseContext
          ? {
              kind: 'ENCOUNTER_ACTOR_ITEM_USE_STATE',
              actorId: actor.id,
              loadoutEntryId: releaseContext.equipment.loadoutEntryId,
              equipmentId: releaseContext.equipment.equipmentId,
              fromState: releaseContext.equipment.state,
              toState: 'CARRIED',
              beforeStateChecksum: released.beforeStateChecksum,
              afterStateChecksum: released.afterStateChecksum
            }
          : null,
      itemDrawTransition:
        handMoved && handMove
          ? {
              kind: 'ENCOUNTER_ACTOR_ITEM_DRAW',
              movement: drawn ? 'DRAW' : 'THROW',
              actorId: actor.id,
              loadoutEntryId: handMove.itemId,
              equipmentId: handMoved.equipmentId,
              slot: handMove.slot,
              beforeStateChecksum: handMoved.beforeStateChecksum,
              afterStateChecksum: handMoved.afterStateChecksum
            }
          : null,
      stateChanged:
        folded.stateChanged ||
        folded.afterAbsence !== actor.absence ||
        batch.enterForm !== undefined ||
        released !== null ||
        handMoved !== null,
      shouldAdvance: false,
      characterUpdate: null
    }
  }

  const loaded = input.characterFacts
  if (
    !loaded ||
    loaded.active.id !== actor.sourceId ||
    loaded.character.systemId !== actor.systemId
  )
    throw new Error('Encounter Character source is unavailable.')
  if (loaded.active.play.streamVersion !== batch.expectedCharacterStreamVersion)
    throw new Error('Encounter Character changed after the outcome was planned.')
  const rawConditions = loaded.character.state.conditions ?? []

  const resourceConsumption = batch.characterResourceConsumption
  let nextResourceUsage = loaded.sheetState.resourceUsage
  if (resourceConsumption !== undefined) {
    if (
      resourceConsumption.characterId !== loaded.active.id ||
      resourceConsumption.expectedStreamVersion !== loaded.active.play.streamVersion ||
      !Number.isSafeInteger(resourceConsumption.cost) ||
      resourceConsumption.cost < 1 ||
      !Number.isSafeInteger(resourceConsumption.beforeUsed) ||
      resourceConsumption.beforeUsed < 0 ||
      !Number.isSafeInteger(resourceConsumption.afterUsed) ||
      resourceConsumption.afterUsed !== resourceConsumption.beforeUsed + resourceConsumption.cost ||
      !Number.isSafeInteger(resourceConsumption.beforeRemaining) ||
      resourceConsumption.beforeRemaining < resourceConsumption.cost ||
      !Number.isSafeInteger(resourceConsumption.afterRemaining) ||
      resourceConsumption.afterRemaining !==
        resourceConsumption.beforeRemaining - resourceConsumption.cost ||
      createCharacterResourceOwnerKey(resourceConsumption.owner) !== resourceConsumption.poolId
    )
      throw new Error('Encounter Character resource consumption is stale.')
    const matchingUsage = loaded.sheetState.resourceUsage.filter(
      (usage) =>
        createCharacterResourceOwnerKey(usage.owner) ===
        createCharacterResourceOwnerKey(resourceConsumption.owner)
    )
    if (matchingUsage.length > 1) throw new Error('Encounter Character resource usage is stale.')
    const existingUsage = matchingUsage[0]
    if (
      (existingUsage?.used ?? 0) !== resourceConsumption.beforeUsed ||
      (existingUsage?.id ?? resourceConsumption.usageId) !== resourceConsumption.usageId
    )
      throw new Error('Encounter Character resource usage is stale.')
    const metadata = existingUsage ?? {
      id: resourceConsumption.usageId,
      characterId: loaded.active.id,
      owner: resourceConsumption.owner,
      createdBy: userId,
      createdAt: batch.occurredAt
    }
    nextResourceUsage = [
      ...loaded.sheetState.resourceUsage.filter(
        (usage) =>
          createCharacterResourceOwnerKey(usage.owner) !==
          createCharacterResourceOwnerKey(resourceConsumption.owner)
      ),
      {
        ...metadata,
        used: resourceConsumption.afterUsed,
        updatedBy: userId,
        updatedAt: batch.occurredAt
      }
    ]
  }

  for (const restore of batch.characterResourceRestores ?? []) {
    const ownerKey = createCharacterResourceOwnerKey(restore.owner)
    const matchingUsage = nextResourceUsage.filter(
      (usage) => createCharacterResourceOwnerKey(usage.owner) === ownerKey
    )
    const [existingUsage] = matchingUsage
    if (
      ownerKey !== restore.poolId ||
      matchingUsage.length !== 1 ||
      !existingUsage ||
      existingUsage.used !== restore.beforeUsed ||
      !Number.isSafeInteger(restore.afterUsed) ||
      restore.afterUsed < 0 ||
      restore.afterUsed >= restore.beforeUsed ||
      !Number.isSafeInteger(restore.beforeRemaining) ||
      restore.beforeRemaining < 0 ||
      !Number.isSafeInteger(restore.afterRemaining) ||
      restore.afterRemaining <= restore.beforeRemaining
    )
      throw new Error('Encounter Character resource restore is stale.')
    nextResourceUsage = nextResourceUsage.map((usage) =>
      usage === existingUsage
        ? { ...usage, used: restore.afterUsed, updatedBy: userId, updatedAt: batch.occurredAt }
        : usage
    )
  }

  const itemConsumption = batch.characterItemConsumption
  let nextItemUsage = loaded.sheetState.itemUsage
  if (itemConsumption !== undefined) {
    const row = loaded.character.state.equipment.inventory.find(
      (item) => item.id === itemConsumption.itemInstanceId
    )
    const currentUsed =
      loaded.sheetState.itemUsage.find(
        (usage) => usage.itemInstanceId === itemConsumption.itemInstanceId
      )?.used ?? 0
    if (
      itemConsumption.characterId !== loaded.active.id ||
      itemConsumption.expectedStreamVersion !== loaded.active.play.streamVersion ||
      !characterItemConsumptionPiecesMatch(itemConsumption) ||
      !row ||
      row.quantity !== itemConsumption.beforeQuantity ||
      currentUsed !== itemConsumption.beforeUsed
    )
      throw new Error('Encounter Character item consumption is stale.')
    nextItemUsage = [
      ...loaded.sheetState.itemUsage.filter(
        (usage) => usage.itemInstanceId !== itemConsumption.itemInstanceId
      ),
      { itemInstanceId: itemConsumption.itemInstanceId, used: itemConsumption.afterUsed }
    ]
  }

  const degrade = batch.degradeItem
  let itemDegradationTransition: CharacterItemDegradationReceiptDto | null = null
  let nextItemDegradation = loaded.sheetState.itemDegradation
  if (degrade !== undefined) {
    const row = loaded.character.state.equipment.inventory.find(
      (item) => item.id === degrade.itemInstanceId
    )
    const beforePenalty =
      nextItemDegradation.find((entry) => entry.itemInstanceId === degrade.itemInstanceId)
        ?.penalty ?? 0
    const beforeUsed =
      nextItemUsage.find((usage) => usage.itemInstanceId === degrade.itemInstanceId)?.used ?? 0
    if (!row || row.quantity - beforeUsed <= 0 || degrade.afterPenalty <= beforePenalty)
      throw new Error('Encounter Character item degradation is stale.')
    const afterUsed = degrade.destroyed ? beforeUsed + 1 : beforeUsed
    nextItemDegradation = [
      ...nextItemDegradation.filter((entry) => entry.itemInstanceId !== degrade.itemInstanceId),
      { itemInstanceId: degrade.itemInstanceId, penalty: degrade.afterPenalty }
    ]
    if (degrade.destroyed)
      nextItemUsage = [
        ...nextItemUsage.filter((usage) => usage.itemInstanceId !== degrade.itemInstanceId),
        { itemInstanceId: degrade.itemInstanceId, used: afterUsed }
      ]
    itemDegradationTransition = {
      characterId: loaded.active.id,
      itemInstanceId: degrade.itemInstanceId,
      beforePenalty,
      afterPenalty: degrade.afterPenalty,
      beforeUsed,
      afterUsed
    }
  }

  let slotsCharacter = loaded.character
  for (const spellConsumption of batch.characterSpellConsumptions ?? []) {
    const currentUsed =
      (slotsCharacter.state.spellSlots ?? []).find(
        (slot) => slot.slotKey === spellConsumption.slotKey
      )?.used ?? 0
    if (
      spellConsumption.characterId !== loaded.active.id ||
      spellConsumption.expectedStreamVersion !== loaded.active.play.streamVersion ||
      spellConsumption.afterUsed !== spellConsumption.beforeUsed + 1 ||
      currentUsed !== spellConsumption.beforeUsed
    )
      throw new Error('Encounter Character spell slot consumption is stale.')
    slotsCharacter = updateSpellSlotUsage(
      slotsCharacter,
      spellConsumption.slotKey,
      () => spellConsumption.afterUsed
    )
  }
  const nextSpellSlots = batch.characterSpellConsumptions?.length
    ? slotsCharacter.state.spellSlots
    : undefined

  const stowItemId = batch.stowEquippedItemInstanceId
  const releaseItemId = batch.releaseHeldItemInstanceId
  const draw = batch.drawHeldItem
  const thrown = batch.throwHeldItem
  // One Character version records one equipment change: a draw follows a stow (the shield an
  // attack stows frees the hand its weapon is drawn into), a throw follows one too, and a drop
  // stands alone.
  if (
    releaseItemId !== undefined &&
    (stowItemId !== undefined || draw !== undefined || thrown !== undefined)
  )
    throw new Error('Encounter Character cannot drop items and stow, draw or throw in one change.')
  if (draw !== undefined && thrown !== undefined)
    throw new Error('Encounter Character cannot draw and throw in one change.')
  const { equipped } = loaded.character.state.equipment
  if (stowItemId !== undefined && !equipped.some((entry) => entry.itemId === stowItemId))
    throw new Error('Encounter Character item to stow is no longer equipped.')
  if (
    releaseItemId !== undefined &&
    !equipped.some((entry) => entry.itemId === releaseItemId && entry.slot !== 'WORN')
  )
    throw new Error('Encounter Character item to drop is no longer held.')
  const afterStow =
    stowItemId === undefined ? loaded.character : unequipCharacterItem(loaded.character, stowItemId)
  if (
    draw !== undefined &&
    afterStow.state.equipment.equipped.some(
      (entry) => entry.itemId === draw.itemId || entry.slot === draw.slot
    )
  )
    throw new Error('Encounter Character weapon to draw is already equipped or its hand is taken.')
  if (
    thrown !== undefined &&
    !afterStow.state.equipment.equipped.some(
      (entry) => entry.itemId === thrown.itemId && entry.slot === thrown.slot
    )
  )
    throw new Error('Encounter Character weapon to throw is no longer in that hand.')
  const handMove = draw ?? thrown
  const equippedCharacter = draw
    ? drawCharacterItem(afterStow, draw.itemId, draw.slot)
    : thrown
      ? unequipCharacterItem(afterStow, thrown.itemId)
      : releaseItemId === undefined
        ? afterStow
        : unequipCharacterItem(loaded.character, releaseItemId)

  const itemTransition = (
    itemInstanceId: string,
    after: CharacterAuthored
  ): CharacterItemUseStateTransitionDto => ({
    kind: 'CHARACTER_ITEM_USE_STATE',
    characterId: loaded.active.id,
    itemInstanceId,
    fromState: 'EQUIPPED',
    toState: 'CARRIED',
    beforeStreamVersion: loaded.active.play.streamVersion,
    afterStreamVersion: loaded.active.play.streamVersion + 1,
    beforeStateChecksum: checksumRuleDocument(loaded.character.state.equipment),
    afterStateChecksum: checksumRuleDocument(after.state.equipment)
  })
  const campaignConditionIds = loaded.campaignContext.conditions.map(
    (condition) => condition.conditionTypeId
  )
  const ownConditionIds = rawConditions.map((condition) => condition.conditionTypeId)
  const sheetHitPoints = loaded.character.state.hitpoints
  const folded = foldCharacterBatch({
    actor,
    batch,
    sheet: {
      currentHitPoints: sheetHitPoints.current,
      temporaryHitPoints: sheetHitPoints.temp,
      temporaryHitPointsSourceEffectId: sheetHitPoints.tempSourceEffectId,
      deathSaves: sheetHitPoints.deathSaves
    },
    ownConditionIds,
    campaignConditionIds
  })
  // A feature-held interception spends its feature's Sheet pool in the same Character version.
  const interceptionCharges = interceptionChargesSpent(folded.applications)
  for (const { poolId, beforeUsed, afterUsed } of interceptionCharges) {
    const owner = batch.damageInterceptions?.find(
      ({ charge }) =>
        charge?.owner !== undefined && createCharacterResourceOwnerKey(charge.owner) === poolId
    )?.charge?.owner
    const matchingUsage = nextResourceUsage.filter(
      (usage) => createCharacterResourceOwnerKey(usage.owner) === poolId
    )
    const [existingUsage] = matchingUsage
    if (!owner || matchingUsage.length > 1 || (existingUsage?.used ?? 0) !== beforeUsed)
      throw new Error('Encounter Character resource usage is stale.')
    nextResourceUsage = [
      ...nextResourceUsage.filter((usage) => usage !== existingUsage),
      {
        ...(existingUsage ?? {
          id: uuidv5(`${loaded.active.id}:${poolId}`, interceptionUsageNamespace),
          characterId: loaded.active.id,
          owner,
          createdBy: userId,
          createdAt: batch.occurredAt
        }),
        used: afterUsed,
        updatedBy: userId,
        updatedAt: batch.occurredAt
      }
    ]
  }
  const existingConditionIds = new Set(ownConditionIds)
  const nextConditionIds = new Set(folded.afterOwnConditionIds)
  // D63: dropping to 0 adds the System's 0 hit point condition and regaining any removes it. It
  // follows from the hit point transition, which the receipt records, so the applications don't list it.
  const zeroHitPointsConditionId = creatureConditionCapabilityRegistry.require(
    loaded.character.systemId
  ).zeroHitPointsConditionDefinitionId
  if (zeroHitPointsConditionId !== null) {
    if (sheetHitPoints.current > 0 && folded.sheet.currentHitPoints === 0)
      nextConditionIds.add(zeroHitPointsConditionId)
    else if (
      sheetHitPoints.current === 0 &&
      folded.sheet.currentHitPoints > 0 &&
      !batch.retainedConditionIds?.includes(zeroHitPointsConditionId)
    )
      nextConditionIds.delete(zeroHitPointsConditionId)
  }
  const conditionStateChanged =
    existingConditionIds.size !== nextConditionIds.size ||
    [...existingConditionIds].some((id) => !nextConditionIds.has(id))
  const nextConditions = [
    ...rawConditions.filter((condition) => nextConditionIds.has(condition.conditionTypeId)),
    ...[...nextConditionIds]
      .filter((id) => !existingConditionIds.has(id))
      .map((conditionTypeId) => ({ conditionTypeId }))
  ]
  const spellSlotsChanged =
    nextSpellSlots !== undefined &&
    JSON.stringify(nextSpellSlots) !== JSON.stringify(loaded.character.state.spellSlots ?? [])
  const sheetStateChanged =
    resourceConsumption !== undefined ||
    batch.characterResourceRestores !== undefined ||
    interceptionCharges.length > 0 ||
    itemConsumption !== undefined ||
    itemDegradationTransition !== null
  const sheetHitPointsChanged =
    sheetHitPoints.current !== folded.sheet.currentHitPoints ||
    sheetHitPoints.temp !== folded.sheet.temporaryHitPoints ||
    sheetHitPoints.tempSourceEffectId !== folded.sheet.temporaryHitPointsSourceEffectId ||
    JSON.stringify(sheetHitPoints.deathSaves) !== JSON.stringify(folded.sheet.deathSaves)
  const shouldAdvance =
    sheetHitPointsChanged ||
    conditionStateChanged ||
    spellSlotsChanged ||
    sheetStateChanged ||
    equippedCharacter !== loaded.character ||
    batch.forceVersionAdvance
  const character = {
    ...equippedCharacter,
    state: {
      ...equippedCharacter.state,
      hitpoints: withCharacterTemporaryHitPoints(
        {
          ...sheetHitPoints,
          current: folded.sheet.currentHitPoints,
          deathSaves: folded.sheet.deathSaves
        },
        targetTemporaryHitPoints(folded.sheet)
      ),
      conditions: nextConditions,
      ...(spellSlotsChanged ? { spellSlots: nextSpellSlots } : {})
    }
  }
  const nextSheetState = sheetStateChanged
    ? characterSheetStateSchema.parse({
        ...loaded.sheetState,
        resourceUsage: nextResourceUsage,
        itemUsage: nextItemUsage,
        itemDegradation: nextItemDegradation
      })
    : null
  // The form is the actor's own state: it changes with its hit points and ends with them (D130).
  const settledActor =
    folded.form === actor.form && folded.afterAbsence === actor.absence
      ? actor
      : { ...actor, form: folded.form, absence: folded.afterAbsence }
  const updatedActor =
    batch.enterForm === undefined
      ? settledActor
      : enterCharacterForm(settledActor, batch.enterForm, batch.effectiveScalarValues ?? {})
  return {
    updatedActor,
    receiptApplications: folded.applications,
    targetTransition: transition(actor.id, folded),
    characterStreamVersion: shouldAdvance ? loaded.active.play.streamVersion + 1 : null,
    itemUseStateTransition: stowItemId === undefined ? null : itemTransition(stowItemId, afterStow),
    itemDegradationTransition,
    itemReleaseTransition:
      releaseItemId === undefined ? null : itemTransition(releaseItemId, equippedCharacter),
    itemDrawTransition: handMove
      ? {
          kind: 'CHARACTER_ITEM_DRAW',
          movement: draw ? 'DRAW' : 'THROW',
          characterId: loaded.active.id,
          itemInstanceId: handMove.itemId,
          slot: handMove.slot,
          beforeStreamVersion: loaded.active.play.streamVersion,
          afterStreamVersion: loaded.active.play.streamVersion + 1,
          beforeStateChecksum: checksumRuleDocument(afterStow.state.equipment),
          afterStateChecksum: checksumRuleDocument(equippedCharacter.state.equipment)
        }
      : null,
    stateChanged:
      folded.stateChanged ||
      conditionStateChanged ||
      folded.form?.effectId !== actor.form?.effectId ||
      batch.enterForm !== undefined,
    shouldAdvance,
    characterUpdate: shouldAdvance
      ? { character: characterAuthoredDtoSchema.parse(character), sheetState: nextSheetState }
      : null
  }
}

/**
 * Folds a Character's applications. While the Character is in a form they change the form's hit
 * points and never the Sheet's; the form ends at 0 and, when it carries excess damage over, the
 * damage past its last hit point is one more `DAMAGE` application on the Sheet (D130 amendment).
 */
function foldCharacterBatch(input: {
  actor: EncounterRunCharacterActorState
  batch: EncounterMechanicsBatchInput
  sheet: {
    currentHitPoints: number
    temporaryHitPoints: number
    temporaryHitPointsSourceEffectId?: string
    deathSaves: CharacterDeathSaves
  }
  ownConditionIds: readonly string[]
  campaignConditionIds: readonly string[]
}) {
  const { actor, batch, sheet } = input
  const { form } = actor
  const shared = {
    targetActorId: actor.id,
    conditionIds: [...new Set([...input.ownConditionIds, ...input.campaignConditionIds])],
    scalarValues: batch.effectiveScalarValues,
    retainedConditionIds: batch.retainedConditionIds,
    layers: {
      ownConditionIds: input.ownConditionIds,
      campaignConditionIds: input.campaignConditionIds
    },
    absence: actor.absence
  }
  if (form === null) {
    const folded = foldCharacterMechanicsApplications({
      ...shared,
      ...sheet,
      maximumHitPoints: batch.effectiveMaximumHitPoints,
      applications: applyDamageInterceptions({
        applications: batch.applications,
        currentHitPoints: sheet.currentHitPoints,
        temporaryHitPoints: sheet.temporaryHitPoints,
        temporaryHitPointsSourceEffectId: sheet.temporaryHitPointsSourceEffectId,
        interceptions: batch.damageInterceptions ?? []
      }),
      ...(batch.damageInterceptions && { damageInterceptions: batch.damageInterceptions }),
      deathSaveRoll: batch.deathSave
    })
    return {
      ...folded,
      form: null,
      sheet: folded.after
    }
  }
  if (batch.sheetMaximumHitPoints === undefined)
    throw new Error('A Character in a form needs its Sheet maximum hit points.')
  const inForm = foldCharacterMechanicsApplications({
    ...shared,
    currentHitPoints: form.currentHitPoints,
    temporaryHitPoints: form.tempHitPoints,
    temporaryHitPointsSourceEffectId: form.tempHitPointsSourceEffectId,
    maximumHitPoints: batch.effectiveMaximumHitPoints,
    deathSaves: null,
    applications: applyDamageInterceptions({
      applications: batch.applications,
      currentHitPoints: form.currentHitPoints,
      temporaryHitPoints: form.tempHitPoints,
      temporaryHitPointsSourceEffectId: form.tempHitPointsSourceEffectId,
      interceptions: batch.damageInterceptions ?? []
    }),
    ...(batch.damageInterceptions && { damageInterceptions: batch.damageInterceptions })
  })
  if (inForm.after.currentHitPoints > 0)
    return {
      ...inForm,
      inForm: true as const,
      form: withActorTemporaryHitPoints(
        {
          ...form,
          currentHitPoints: inForm.after.currentHitPoints,
          maxHitPoints: inForm.after.maximumHitPoints
        },
        targetTemporaryHitPoints(inForm.after)
      ),
      sheet
    }
  // The form's last damage names where the carried-over damage came from.
  let excessDamage = 0
  let lastDamageIndex = -1
  for (const [index, application] of inForm.applications.entries()) {
    if (application.kind !== 'DAMAGE') continue
    excessDamage += application.resolvedAmount - application.appliedAmount
    lastDamageIndex = index
  }
  const lastDamage = batch.applications[lastDamageIndex]
  const temporaryLost = Math.min(sheet.temporaryHitPoints, excessDamage)
  const currentLost = Math.min(sheet.currentHitPoints, excessDamage - temporaryLost)
  const carriedOver: CharacterRuleActionApplication[] =
    form.excessDamageCarriesOver && excessDamage > 0 && lastDamage?.kind === 'DAMAGE'
      ? [
          {
            ...lastDamage,
            damageDisposition: 'NORMAL',
            incomingHalved: false,
            critical: false,
            requestedAmount: excessDamage,
            resolvedAmount: excessDamage,
            appliedAmount: temporaryLost + currentLost,
            beforeCurrentHitPoints: sheet.currentHitPoints,
            afterCurrentHitPoints: sheet.currentHitPoints - currentLost,
            beforeTemporaryHitPoints: sheet.temporaryHitPoints,
            afterTemporaryHitPoints: sheet.temporaryHitPoints - temporaryLost,
            maximumHitPoints: batch.sheetMaximumHitPoints
          }
        ]
      : []
  const onSheet = foldCharacterMechanicsApplications({
    ...shared,
    conditionIds: inForm.after.conditionIds,
    layers: {
      ownConditionIds: inForm.afterOwnConditionIds,
      campaignConditionIds: input.campaignConditionIds
    },
    scalarValues: inForm.after.scalarValues,
    retainedConditionIds: undefined,
    absence: inForm.afterAbsence,
    ...sheet,
    maximumHitPoints: batch.sheetMaximumHitPoints,
    applications: carriedOver
  })
  return {
    before: inForm.before,
    after: onSheet.after,
    applications: [
      ...inForm.applications,
      ...onSheet.applications.map((application) => ({
        ...application,
        ordinal: application.ordinal + inForm.applications.length
      }))
    ],
    afterOwnConditionIds: onSheet.afterOwnConditionIds,
    afterAbsence: onSheet.afterAbsence,
    stateChanged: true,
    inForm: true as const,
    form: null,
    sheet: onSheet.after
  }
}

function transition(
  actorId: string,
  { before, after, inForm }: { before: TargetState; after: TargetState; inForm?: true }
) {
  return {
    checksum: targetTransitionChecksum(actorId, before),
    before,
    after,
    ...(inForm && { inForm })
  }
}
