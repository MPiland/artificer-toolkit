import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import {
  featureChargeUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { applyEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import { encounterStowedItemInstanceId } from '@artificer-toolkit/rules-runtime/encounterWieldConflict'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { writeRunActor } from './documents.js'
import { engageIdleTurnActor } from './idleTurnMark.js'
import type { EncounterWriteContext } from './store.js'

type SourceSpendReceipts = Pick<
  Extract<ServerRuleExecutionApplicationOutputsDto, { kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }>,
  | 'resourceConsumption'
  | 'sourceItemConsumption'
  | 'spellCastConsumption'
  | 'featureResourceConsumption'
  | 'actionEconomyTransition'
  | 'attackActionTransition'
  | 'sourceItemDraw'
  | 'sourceItemDegradation'
>

/**
 * Checks the admitted Character resource, item and stow the source spends against the receipts the
 * outcome recorded, and shapes the mutation the source Character's mechanics apply. A single-target
 * action records them on its batch; an area records them once on its root.
 */
export function sourceSpendMutation(input: {
  source: EncounterRunActorState
  command: Pick<ResolveEncounterActionInputDto, 'acceptedWieldConflict'>
  resource: LiveSessionEncounterActionCommitInput['resourceConsumption']
  item: LiveSessionEncounterActionCommitInput['itemConsumption']
  spell: LiveSessionEncounterActionCommitInput['spellConsumption']
  receipts: Pick<
    SourceSpendReceipts,
    'resourceConsumption' | 'sourceItemConsumption' | 'spellCastConsumption'
  > &
    /** Only a directly resolved attack draws its weapon (D107). */
    Partial<Pick<SourceSpendReceipts, 'sourceItemDraw' | 'sourceItemDegradation'>>
}) {
  const { source, resource, item, spell, receipts } = input
  if (resource) {
    const {
      owner: _owner,
      usageId: _usage,
      characterId,
      // The mechanics batch checks it against the fenced Character it plans with.
      expectedStreamVersion: _expectedStreamVersion,
      ...receipt
    } = resource
    if (
      source.kind !== 'CHARACTER' ||
      source.sourceId !== characterId ||
      checksumCanonicalJson(receipt) !== checksumCanonicalJson(receipts.resourceConsumption)
    )
      throw new Error('Live Session action resource scope mismatch.')
  } else if (receipts.resourceConsumption !== null)
    throw new Error('Live Session action resource is missing.')
  if (item) {
    // The mechanics batch checks the version against the fenced Character it plans with.
    const { expectedStreamVersion: _itemStreamVersion, ...receipt } = item
    if (
      source.kind !== 'CHARACTER' ||
      source.sourceId !== item.characterId ||
      checksumCanonicalJson(receipt) !== checksumCanonicalJson(receipts.sourceItemConsumption)
    )
      throw new Error('Live Session action item scope mismatch.')
  } else if (receipts.sourceItemConsumption !== null)
    throw new Error('Live Session action item is missing.')
  if (spell) {
    // The mechanics batch checks the version against the fenced Character it plans with.
    const { expectedStreamVersion: _spellStreamVersion, characterId, ...receipt } = spell
    if (
      source.kind !== 'CHARACTER' ||
      source.sourceId !== characterId ||
      checksumCanonicalJson({ owner: { kind: 'CHARACTER', characterId }, ...receipt }) !==
        checksumCanonicalJson(receipts.spellCastConsumption)
    )
      throw new Error('Live Session action spell slot scope mismatch.')
    // A Creature's slot row settles with its feature charges.
  } else if (receipts.spellCastConsumption?.owner.kind === 'CHARACTER')
    throw new Error('Live Session action spell slot is missing.')
  const stow = input.command.acceptedWieldConflict
  if (stow && source.kind !== 'CHARACTER') throw new Error('Live Session stow scope mismatch.')
  const draw = receipts.sourceItemDraw
  if (
    draw &&
    (draw.kind === 'CHARACTER_ITEM_DRAW'
      ? source.kind !== 'CHARACTER' || source.sourceId !== draw.characterId
      : source.kind !== 'CREATURE' || source.id !== draw.actorId)
  )
    throw new Error('Live Session weapon hand move scope mismatch.')
  const degradation = receipts.sourceItemDegradation
  if (degradation && (source.kind !== 'CHARACTER' || source.sourceId !== degradation.characterId))
    throw new Error('Live Session weapon degradation scope mismatch.')
  return {
    spends: Boolean(resource || item || spell || stow || draw || degradation),
    mutation: {
      ...(resource ? { characterResourceConsumption: resource } : {}),
      ...(item ? { characterItemConsumption: item } : {}),
      ...(spell ? { characterSpellConsumptions: [spell] } : {}),
      ...(stow ? { stowEquippedItemInstanceId: encounterStowedItemInstanceId(stow) } : {}),
      ...(draw ? handMoveMutation(draw) : {}),
      ...(degradation
        ? {
            degradeItem: {
              itemInstanceId: degradation.itemInstanceId,
              afterPenalty: degradation.afterPenalty,
              destroyed: degradation.afterUsed > degradation.beforeUsed
            }
          }
        : {})
    }
  }
}

/** The batch input that replays a recorded draw into a hand or throw out of it. */
function handMoveMutation(draw: NonNullable<SourceSpendReceipts['sourceItemDraw']>) {
  const heldItem = {
    itemId: draw.kind === 'CHARACTER_ITEM_DRAW' ? draw.itemInstanceId : draw.loadoutEntryId,
    slot: draw.slot
  }
  return draw.movement === 'THROW' ? { throwHeldItem: heldItem } : { drawHeldItem: heldItem }
}

type SpendMutation = ReturnType<typeof sourceSpendMutation>['mutation']

/**
 * One Character's spends in a terminal commit as a single mutation: its casts' slots apply in the order
 * given (a cast, then a counter to a Counterspell against it) on one Character version.
 */
export function combineSpendMutations(...mutations: readonly SpendMutation[]): SpendMutation {
  const characterSpellConsumptions = mutations.flatMap(
    (mutation) => mutation.characterSpellConsumptions ?? []
  )
  return {
    ...mutations.reduce<SpendMutation>((all, mutation) => ({ ...all, ...mutation }), {}),
    ...(characterSpellConsumptions.length > 0 ? { characterSpellConsumptions } : {})
  }
}

/**
 * Applies the source's feature charge, Creature spell slot row, action economy and Attack action to the source as its outcome
 * left it, and writes the actor when they changed it. Returns the source as settled.
 */
export async function settleActionSourceSpend(
  ctx: EncounterWriteContext,
  input: {
    encounterId: string
    /** The source as the outcome left it; the stored actor must still be exactly this. */
    source: EncounterRunActorState
    spend: Pick<
      SourceSpendReceipts,
      'featureResourceConsumption' | 'actionEconomyTransition' | 'attackActionTransition'
    > &
      Partial<Pick<SourceSpendReceipts, 'spellCastConsumption'>>
    economyOverridden: boolean
    /** The source attacked a hostile creature: an actor armed for an idle-bound grant is marked engaged. */
    engages?: boolean
  }
) {
  const { source, spend } = input
  let settledSource = source
  const feature = spend.featureResourceConsumption
  if (feature) {
    if (
      source.kind !== 'CREATURE' ||
      feature.ownerActorId !== source.id ||
      featureChargeUsed(settledSource, feature.ownerFeatureId) !== feature.beforeUsed ||
      feature.afterUsed !== feature.beforeUsed + feature.cost ||
      feature.afterRemaining !== feature.beforeRemaining - feature.cost
    )
      throw new Error('Live Session feature resource receipt mismatch.')
    settledSource = encounterRunActorStateSchema.parse({
      ...settledSource,
      resources: withFeatureChargeUsed(settledSource, feature.ownerFeatureId, feature.afterUsed)
    })
  }
  const slot = spend.spellCastConsumption
  if (slot?.owner.kind === 'CREATURE') {
    if (
      source.kind !== 'CREATURE' ||
      slot.owner.actorId !== source.id ||
      featureChargeUsed(settledSource, slot.slotKey) !== slot.beforeUsed
    )
      throw new Error('Live Session spell slot receipt mismatch.')
    settledSource = encounterRunActorStateSchema.parse({
      ...settledSource,
      resources: withFeatureChargeUsed(settledSource, slot.slotKey, slot.afterUsed)
    })
  }
  if (spend.actionEconomyTransition)
    settledSource = consumeEncounterActionEconomy({
      actor: settledSource,
      consumption: spend.actionEconomyTransition,
      overridden: input.economyOverridden
    })
  if (spend.attackActionTransition)
    settledSource = applyEncounterAttackActionTransition(
      settledSource,
      spend.attackActionTransition
    )
  if (input.engages) settledSource = engageIdleTurnActor(settledSource)
  if (checksumCanonicalJson(settledSource) !== checksumCanonicalJson(source)) {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', input.encounterId).eq('id', source.id)
      )
      .unique()
    if (!row || row.stateChecksum !== checksumRunActorPlayState(source))
      throw new Error('Encounter action source changed before settlement.')
    await writeRunActor(ctx, row._id, settledSource)
  }
  return settledSource
}
