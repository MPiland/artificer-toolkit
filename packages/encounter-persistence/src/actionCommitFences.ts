import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { readLiveEncounterActionAdmission } from './liveActionAdmission.js'
import type { EncounterReadTransaction } from './ports.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'

/**
 * Admits a terminal action commit (single-target, area, countered cast or gated action). A lost
 * response replays before any revision its transaction consumed is checked, so its stored result
 * comes back already presented for the member.
 */
export async function admitActionCommit(
  ctx: EncounterReadTransaction,
  input: Parameters<typeof readLiveEncounterActionAdmission>[1]
) {
  const admission = await readLiveEncounterActionAdmission(ctx, input)
  if (admission.kind !== 'REPLAY') return admission
  return {
    kind: 'REPLAY' as const,
    result: await presentEncounterResultForMember(ctx, {
      campaign: admission.campaign,
      membership: admission.membership,
      result: admission.result
    })
  }
}

/**
 * Throws unless the room's rule output covers exactly the Run's non-Character actors. `label` names
 * the committing action in the error.
 */
export function requireRuleOutputScope(
  actors: readonly EncounterRunActorState[],
  rules: EncounterActorRuleOutput,
  label: 'action' | 'area' | 'countered cast' | 'gated action'
) {
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    rules.actors.length !== ruleActors.length ||
    new Set(rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
    rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
  )
    throw new Error(`Live Session ${label} output scope mismatch.`)
}

/**
 * The last reads before a commit writes: the revisions the room planned against are still current,
 * and every occurrence the commit settles is new or the pending one it resumes.
 */
export async function requireActionCommitFence(
  ctx: EncounterReadContext,
  input: {
    state: EncounterRunState
    characterIds: readonly string[]
    revisions: LiveSessionRulesRevisions
    occurrenceIds: readonly string[]
    pendingOccurrence: EncounterDocument<'encounterRuleOccurrences'> | null
    validateReadFence(
      state: EncounterRunState,
      characterIds: readonly string[],
      revisions: LiveSessionRulesRevisions
    ): Promise<void>
  }
) {
  await input.validateReadFence(input.state, input.characterIds, input.revisions)
  for (const occurrenceId of input.occurrenceIds) {
    const collision = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
      .unique()
    if (collision && collision._id !== input.pendingOccurrence?._id)
      throw new Error('Encounter rule occurrence ID was already used.')
  }
}
