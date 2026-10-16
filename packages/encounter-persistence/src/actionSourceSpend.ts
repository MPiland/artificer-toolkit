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
  withEncounterActorEngaged,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { applyEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { writeRunActor } from './documents.js'
import type { EncounterWriteContext } from './store.js'

type SourceSpendReceipts = Pick<
  Extract<ServerRuleExecutionApplicationOutputsDto, { kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }>,
  | 'resourceConsumption'
  | 'sourceItemConsumption'
  | 'spellCastConsumption'
  | 'featureResourceConsumption'
  | 'actionEconomyTransition'
  | 'attackActionTransition'
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
  >
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
    const { expectedStreamVersion: _spellStreamVersion, ...receipt } = spell
    if (
      source.kind !== 'CHARACTER' ||
      source.sourceId !== spell.characterId ||
      checksumCanonicalJson(receipt) !== checksumCanonicalJson(receipts.spellCastConsumption)
    )
      throw new Error('Live Session action spell slot scope mismatch.')
  } else if (receipts.spellCastConsumption !== null)
    throw new Error('Live Session action spell slot is missing.')
  const stow = input.command.acceptedWieldConflict
  if (stow && source.kind !== 'CHARACTER')
    throw new Error('Live Session shield stow scope mismatch.')
  return {
    spends: Boolean(resource || item || spell || stow),
    mutation: {
      ...(resource ? { characterResourceConsumption: resource } : {}),
      ...(item ? { characterItemConsumption: item } : {}),
      ...(spell ? { characterSpellConsumption: spell } : {}),
      ...(stow ? { stowEquippedItemInstanceId: stow.shieldItemInstanceId } : {})
    }
  }
}

/**
 * Applies the source's feature charge, action economy and Attack action to the source as its outcome
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
    >
    economyOverridden: boolean
    /** The source attacked a hostile creature while holding an idle-bound grant: it is marked engaged. */
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
  if (input.engages)
    settledSource = encounterRunActorStateSchema.parse({
      ...settledSource,
      resources: withEncounterActorEngaged(settledSource, true)
    })
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
