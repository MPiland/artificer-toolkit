import type { ActiveRuleEffectOwner } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { EncounterActorAbsenceDto } from '@artificer-toolkit/schema/api/encounterData'
import { readRunActors, readRunState, writeRunActor } from './documents.js'
import type { EncounterWriteContext } from './store.js'

type PlayAbsenceDefinition = Pick<ActiveRuleEffectDefinitionDto, 'stateContributions'>

/** The `PLAY_ABSENCE` an effect holds, or null when it does not take its holder out of play. */
export function playAbsenceContribution(definition: PlayAbsenceDefinition) {
  for (const contribution of definition.stateContributions)
    if (contribution.kind === 'PLAY_ABSENCE') return contribution
  return null
}

function effectAbsence(effects: readonly PlayAbsenceDefinition[]): EncounterActorAbsenceDto | null {
  const held = effects.flatMap((effect) => playAbsenceContribution(effect) ?? [])
  if (held.length === 0) return null
  return held.every(({ keepsTurn }) => keepsTurn) ? 'EFFECT_KEEPS_TURN' : 'EFFECT'
}

/**
 * Puts the holder of `effects` (its effects after the change) out of play, or back in it, as the
 * `PLAY_ABSENCE` effects it still holds say. An absence the table or another effect owns (`GM_REMOVED`,
 * `DEPARTED`) is left alone, so an effect ending never returns an actor something else removed.
 */
export async function syncPlayAbsence(
  ctx: EncounterWriteContext,
  input: {
    owner: ActiveRuleEffectOwner
    sourceEncounterId: string | null
    effects: readonly PlayAbsenceDefinition[]
  }
) {
  const encounterId =
    input.owner.kind === 'ENCOUNTER_ACTOR' ? input.owner.encounterId : input.sourceEncounterId
  if (encounterId === null) return
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const actors = await readRunActors(ctx, readRunState(run))
  const holder = actors.find((actor) =>
    input.owner.kind === 'ENCOUNTER_ACTOR'
      ? actor.id === input.owner.targetActorId
      : actor.kind === 'CHARACTER' && actor.sourceId === input.owner.characterId
  )
  if (!holder) return
  const next = effectAbsence(input.effects)
  const current = holder.absence
  if (current === 'GM_REMOVED' || current === 'DEPARTED' || current === next) return
  const row = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', holder.id))
    .unique()
  if (!row) throw new Error('Encounter actor was not found.')
  await writeRunActor(ctx, row._id, { ...holder, absence: next })
}
