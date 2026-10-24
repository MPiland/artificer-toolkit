import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import {
  creatureFormContribution,
  revertActorForm,
  type EncounterActorFormCreature
} from '@artificer-toolkit/rules-runtime/encounterActorForm'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { readRunActors, readRunActorWithRow, readRunState, writeRunActor } from './documents.js'
import type { EncounterWritePorts } from './ports.js'
import type { EncounterWriteContext } from './store.js'

/** Whether the effect is the rule that holds a creature form (D130); only its end touches the actor. */
export function holdsActorForm(definition: ActiveRuleEffectDefinitionDto) {
  return creatureFormContribution({ definition }) !== null
}

/** The Creature a created form effect swaps in, or null when the effect holds no form. */
export function createdFormCreatureId(effect: Pick<ActiveRuleEffectRecord, 'definition'>) {
  return creatureFormContribution(effect)?.creatureId ?? null
}

/**
 * Reads the Creature a form swaps in, for the Campaign's Game System, as the Campaign's owner may
 * read it: a player casts the form but never needs access to the Creature's source.
 */
export async function readActorFormCreature(
  ports: Pick<EncounterWritePorts, 'requireCampaignAuthority' | 'snapshotBlueprintEnemies'>,
  input: { campaignId: string; userId: string; gameSystemId: string; creatureId: string }
): Promise<EncounterActorFormCreature> {
  const { campaign } = await ports.requireCampaignAuthority(input.campaignId, input.userId)
  const [enemy] = await ports.snapshotBlueprintEnemies(campaign.ownerUserId, {
    gameSystemId: input.gameSystemId,
    enemies: [{ kind: 'CREATURE', sourceId: input.creatureId }]
  })
  if (
    enemy?.kind !== 'CREATURE' ||
    enemy.sourceId === null ||
    enemy.sourceRevision === null ||
    enemy.systemId !== input.gameSystemId
  )
    throw new Error('The creature form does not match the Campaign Game System.')
  return {
    systemId: enemy.systemId,
    sourceId: enemy.sourceId,
    sourceRevision: enemy.sourceRevision,
    snapshot: enemy.snapshot,
    maxHitPoints: enemy.maxHitPoints
  }
}

/**
 * The mechanics-batch input that enters the form a created effect holds (D130), so the Worker's
 * plan and the room's persistence swap the actor identically. Undefined for any other effect.
 */
export function actorFormEntry(
  effect: Pick<ActiveRuleEffectRecord, 'id' | 'definition'>,
  creature: EncounterActorFormCreature
): EncounterMechanicsBatchInput['enterForm'] {
  const form = creatureFormContribution(effect)
  return form
    ? {
        effectId: effect.id,
        excessDamageCarriesOver: form.excessDamageCarriesOver,
        retainedAbilityIds: form.retainedAbilityIds,
        creature
      }
    : undefined
}

/**
 * Ends the form an ended effect held (D130), restoring the origin through the one revert. Idempotent:
 * an actor already out of the form, or in another one, is left alone.
 */
export async function endActorFormHeldBy(
  ctx: EncounterWriteContext,
  input: { encounterId: string; actorId: string; effectId: string }
) {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { row, actor } = await readRunActorWithRow(ctx, readRunState(run), input.actorId)
  if (actor.form?.effectId !== input.effectId) return
  await writeRunActor(ctx, row._id, revertActorForm(actor))
}

/**
 * Ends the form a Character-owned effect held (D130 amendment): the effect names its Character, so
 * the Run actor that wears the form is found among the Encounter's actors.
 */
export async function endCharacterFormHeldBy(
  ctx: EncounterWriteContext,
  input: { encounterId: string; characterId: string; effectId: string }
) {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const wearer = (await readRunActors(ctx, readRunState(run))).find(
    (actor) =>
      actor.kind === 'CHARACTER' &&
      actor.sourceId === input.characterId &&
      actor.form?.effectId === input.effectId
  )
  if (wearer)
    await endActorFormHeldBy(ctx, {
      encounterId: input.encounterId,
      actorId: wearer.id,
      effectId: input.effectId
    })
}
