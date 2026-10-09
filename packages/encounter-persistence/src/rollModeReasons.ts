import {
  collectEncounterRollModeContributors,
  labelEncounterRollModeReasons,
  type EncounterD20Contributor,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { readCharacterEffect, readEncounterEffect } from './effectStore.js'
import { readRunActors, readRunState } from './documents.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The label of authored content, a rule definition or a System condition with this id. */
async function readIdentityLabel(
  ctx: EncounterReadTransaction,
  id: string,
  conditionLabels: ReadonlyMap<string, string>
): Promise<string | null> {
  return (await ctx.ports.readContentLabel(id)) ?? conditionLabels.get(id) ?? null
}

/**
 * A contributor's source label and the Encounter actors it comes from. Source ids name their origin:
 * an active effect (`active-effect:<id>`, owned by and cast by actors), a basic action held by the
 * actor its domain key names (`basic-action:<holderId>`), a condition of the actor its domain key
 * names (`condition:<holderId>`, D94), or a key whose identities are the authored
 * source, item, feature or rule definition, the first of which with a label names it.
 */
async function readContributorSource(
  ctx: EncounterReadTransaction,
  contributor: EncounterD20Contributor,
  conditionLabels: ReadonlyMap<string, string>
): Promise<{ label: string | null; actorIds: readonly string[]; hidden?: boolean }> {
  const parts = contributor.sourceId.split(':').map((part) => decodeURIComponent(part))
  if (parts[0] === 'active-effect' || parts[0] === 'active-effect-perception') {
    const effectId = parts[1] ?? ''
    const encounterRow = await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_publicId', (q) => q.eq('id', effectId))
      .unique()
    const characterRow = encounterRow
      ? null
      : await ctx.db
          .query('characterActiveRuleEffects')
          .withIndex('by_publicId', (q) => q.eq('id', effectId))
          .unique()
    const effect = encounterRow
      ? readEncounterEffect(encounterRow)
      : characterRow && readCharacterEffect(characterRow)
    if (!effect) return { label: null, actorIds: [] }
    const origin = effect.definition.origin
    // A modifier grant froze its granting item's label; the authored effect id has none.
    const grant =
      effect.definition.schemaVersion === 2
        ? effect.definition.stateContributions.find(
            (contribution) => contribution.kind === 'MODIFIER_GRANT'
          )
        : undefined
    if (grant)
      return {
        label: grant.sourceLabel,
        hidden: grant.sourceHidden,
        actorIds: [
          ...(effect.owner.kind === 'ENCOUNTER_ACTOR' ? [effect.owner.targetActorId] : []),
          ...(origin.kind === 'ENCOUNTER' && origin.sourceActorId ? [origin.sourceActorId] : [])
        ]
      }
    return {
      label: await readIdentityLabel(ctx, effect.definition.authoredEffectId, conditionLabels),
      actorIds: [
        ...(effect.owner.kind === 'ENCOUNTER_ACTOR' ? [effect.owner.targetActorId] : []),
        ...(origin.kind === 'ENCOUNTER' && origin.sourceActorId ? [origin.sourceActorId] : [])
      ]
    }
  }
  const holder = /^(?:basic-action|condition):(.+)$/.exec(contributor.domainKey ?? '')?.[1] ?? null
  // A condition's rule-state definition shares its id, so the System condition label names it.
  if (parts[0] === 'condition') {
    const conditionId = parts[1]?.toLowerCase() ?? ''
    return {
      label: conditionLabels.get(conditionId) ?? (await ctx.ports.readContentLabel(conditionId)),
      actorIds: holder ? [holder] : []
    }
  }
  for (const part of parts) {
    if (!UUID.test(part)) continue
    const label = await readIdentityLabel(ctx, part.toLowerCase(), conditionLabels)
    if (label) return { label, actorIds: holder ? [holder] : [] }
  }
  return { label: null, actorIds: holder ? [holder] : [] }
}

function contributorKey(contributor: EncounterD20Contributor) {
  return `${contributor.sourceId}\u0000${contributor.domainKey ?? ''}`
}

/**
 * Builds a pending summary with the reasons for its derived d20 mode (ADR 0034, D13). The pure
 * builder runs once to collect the contributors it reports, their source labels are read, and it
 * runs again with those labels. A player never reads the label of a contributor that comes from an
 * actor hidden from players; its advantage or disadvantage still applies under a generic reason.
 */
export async function withEncounterRollModeReasons<T>(
  ctx: EncounterReadTransaction,
  run: EncounterDocument<'encounterRuns'>,
  membership: Pick<EncounterDocument<'campaignMemberships'>, 'role'>,
  build: (reasons: EncounterRollModeReasons) => T
): Promise<T> {
  const contributors: EncounterD20Contributor[] = []
  const unlabeled = build(collectEncounterRollModeContributors(contributors))
  if (!contributors.length) return unlabeled
  const system = await ctx.ports.requireSystem(run.gameSystemId)
  const conditionLabels = new Map(
    system.conditionTypes.map((condition) => [condition.id, condition.label])
  )
  const hiddenActorIds =
    membership.role === 'OWNER'
      ? new Set<string>()
      : new Set(
          (await readRunActors(ctx, readRunState(run)))
            .filter((actor) => !actor.public)
            .map((actor) => actor.id)
        )
  const labels = new Map<string, string>()
  const hiddenContributors = new Set<string>()
  for (const contributor of contributors) {
    const source = await readContributorSource(ctx, contributor, conditionLabels)
    if (source.label) labels.set(contributor.sourceId, source.label)
    if (
      (source.hidden && membership.role !== 'OWNER') ||
      source.actorIds.some((actorId) => hiddenActorIds.has(actorId))
    )
      hiddenContributors.add(contributorKey(contributor))
  }
  return build(
    labelEncounterRollModeReasons(labels, (contributor) =>
      hiddenContributors.has(contributorKey(contributor))
    )
  )
}
