import {
  collectEncounterRollModeContributors,
  labelEncounterRollModeReasons,
  rollModeSourceKey,
  type EncounterD20Contributor,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { readCharacterEffect, readEncounterEffect } from './effectStore.js'
import { readRunActors, readRunState } from './documents.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/** The label of authored content, a rule definition or a System condition with this id. */
async function readIdentityLabel(
  ctx: EncounterReadTransaction,
  id: string,
  conditionLabels: ReadonlyMap<string, string>
): Promise<string | null> {
  return (await ctx.ports.readContentLabel(id)) ?? conditionLabels.get(id) ?? null
}

/**
 * A contributor's source label and the Encounter actors it comes from, by its typed source kind: an
 * active effect (owned by and cast by actors), a condition of the actor its source names (D94), or
 * the authored definition that names it. Rules-owned sources carry no label here and no actor.
 */
async function readContributorSource(
  ctx: EncounterReadTransaction,
  { source }: EncounterD20Contributor,
  conditionLabels: ReadonlyMap<string, string>,
  consumedGrants: readonly ActiveRuleEffectRecord[]
): Promise<{ label: string | null; actorIds: readonly string[]; hidden?: boolean }> {
  const holderActorIds = source.holderActorId ? [source.holderActorId] : []
  switch (source.kind) {
    case 'RULE':
      return { label: null, actorIds: [] }
    case 'CONDITION':
      // A condition's rule-state definition shares its id, so the System condition label names it.
      return {
        label: conditionLabels.get(source.id) ?? (await ctx.ports.readContentLabel(source.id)),
        actorIds: holderActorIds
      }
    case 'AUTHORED':
      return {
        label: await readIdentityLabel(ctx, source.id, conditionLabels),
        actorIds: holderActorIds
      }
    case 'ACTIVE_EFFECT':
      return readActiveEffectSource(ctx, source.id, conditionLabels, consumedGrants)
  }
}

async function readActiveEffectSource(
  ctx: EncounterReadTransaction,
  effectId: string,
  conditionLabels: ReadonlyMap<string, string>,
  consumedGrants: readonly ActiveRuleEffectRecord[]
): Promise<{ label: string | null; actorIds: readonly string[]; hidden?: boolean }> {
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
  // A grant its roll used up is gone from the stores; the command that consumed it kept its record.
  const effect = encounterRow
    ? readEncounterEffect(encounterRow)
    : characterRow
      ? readCharacterEffect(characterRow)
      : consumedGrants.find((grant) => grant.id === effectId)
  if (!effect) return { label: null, actorIds: [] }
  const origin = effect.definition.origin
  const actorIds = [
    ...(effect.owner.kind === 'ENCOUNTER_ACTOR' ? [effect.owner.targetActorId] : []),
    ...(origin.kind === 'ENCOUNTER' && origin.sourceActorId ? [origin.sourceActorId] : [])
  ]
  // A modifier grant froze its granting item's label; the authored effect id has none.
  const grant = effect.definition.stateContributions.find(
    (contribution) => contribution.kind === 'MODIFIER_GRANT'
  )
  if (grant) return { label: grant.sourceLabel, hidden: grant.sourceHidden, actorIds }
  return {
    label: await readIdentityLabel(ctx, effect.definition.authoredEffectId, conditionLabels),
    actorIds
  }
}

function contributorKey({ source }: EncounterD20Contributor) {
  return `${rollModeSourceKey(source)}\u0000${source.holderActorId ?? ''}`
}

/**
 * Builds a pending summary with the reasons for its derived d20 mode (ADR 0034, D13). The pure
 * builder runs once to collect the contributors it reports, their source labels are read, and it
 * runs again with those labels. A player never reads the label of a contributor that comes from an
 * actor hidden from players; its advantage or disadvantage still applies under a generic reason.
 * consumedGrants are the one-roll grants the pending roll's command already used up: their rows
 * are deleted, so their records name them.
 */
export async function withEncounterRollModeReasons<T>(
  ctx: EncounterReadTransaction,
  run: EncounterDocument<'encounterRuns'>,
  membership: Pick<EncounterDocument<'campaignMemberships'>, 'role'>,
  build: (reasons: EncounterRollModeReasons) => T,
  consumedGrants: readonly ActiveRuleEffectRecord[] = []
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
    const source = await readContributorSource(ctx, contributor, conditionLabels, consumedGrants)
    if (source.label) labels.set(rollModeSourceKey(contributor.source), source.label)
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
