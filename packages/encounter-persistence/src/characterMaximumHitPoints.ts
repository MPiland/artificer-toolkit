import { effectiveHitPointMaximum } from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readEncounterCharacterPlay } from './characterPlay.js'
import { listActiveRuleEffects } from './effectStore.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'

/**
 * The maximum hit points the Sheet shows, read from a Character's play record: the stored maximum (before
 * active effects) with the Character's active maximum grants and reductions applied.
 */
export async function readCharacterMaximumHitPoints(
  ctx: EncounterReadContext,
  play: Pick<EncounterDocument<'characterPlayStates'>, 'characterId' | 'maximumHitPoints'>
) {
  return effectiveHitPointMaximum(
    play.maximumHitPoints,
    await listActiveRuleEffects(ctx, { kind: 'CHARACTER', characterId: play.characterId })
  )
}

/**
 * The maximum hit points an Encounter actor's damage is measured against, as the room derives it: a
 * Character's Sheet maximum, or the form's or actor's own maximum with its held effects. Null when a
 * Character has no play record.
 */
export async function readEncounterActorMaximumHitPoints(
  ctx: EncounterReadContext,
  input: { encounterId: string; actor: EncounterRunActorState }
) {
  const { actor } = input
  const held = async (base: number) =>
    effectiveHitPointMaximum(
      base,
      await listActiveRuleEffects(ctx, turnEffectOwner(actor, input.encounterId))
    )
  if (actor.kind !== 'CHARACTER') return held(actor.maxHitPoints)
  if (actor.form) return held(actor.form.maxHitPoints)
  const play = actor.sourceId ? await readEncounterCharacterPlay(ctx, actor.sourceId) : null
  return play ? readCharacterMaximumHitPoints(ctx, play) : null
}
