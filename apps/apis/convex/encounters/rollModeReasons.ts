import {
  collectEncounterRollModeContributors,
  labelEncounterRollModeReasons,
  type EncounterD20Contributor,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import type { QueryCtx } from '../_generated/server'
import { requireSystem } from '../content/systemDocuments'
import { readCharacterEffect, readEncounterEffect } from '../rules/effectStore'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The label of authored content, a rule definition or a System condition with this id. */
async function readIdentityLabel(
  ctx: QueryCtx,
  id: string,
  conditionLabels: ReadonlyMap<string, string>
): Promise<string | null> {
  const authored = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
  if (authored) return authored.label
  const definition = await ctx.db
    .query('reusableDefinitions')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
  return definition?.label ?? conditionLabels.get(id) ?? null
}

/**
 * A contributor's source label. Source ids name their origin: an active effect
 * (`active-effect:<id>`), or a key whose identities are the authored source, item, feature or rule
 * definition, the first of which with a label names it.
 */
async function readContributorLabel(
  ctx: QueryCtx,
  sourceId: string,
  conditionLabels: ReadonlyMap<string, string>
): Promise<string | null> {
  const parts = sourceId.split(':').map((part) => decodeURIComponent(part))
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
    return effect
      ? readIdentityLabel(ctx, effect.definition.authoredEffectId, conditionLabels)
      : null
  }
  for (const part of parts) {
    if (!UUID.test(part)) continue
    const label = await readIdentityLabel(ctx, part.toLowerCase(), conditionLabels)
    if (label) return label
  }
  return null
}

/**
 * Builds a pending summary with the reasons for its derived d20 mode (ADR 0034, D13). The pure
 * builder runs once to collect the contributors it reports, their source labels are read, and it
 * runs again with those labels.
 */
export async function withEncounterRollModeReasons<T>(
  ctx: QueryCtx,
  gameSystemId: string,
  build: (reasons: EncounterRollModeReasons) => T
): Promise<T> {
  const contributors: EncounterD20Contributor[] = []
  const unlabeled = build(collectEncounterRollModeContributors(contributors))
  if (!contributors.length) return unlabeled
  const system = await requireSystem(ctx, gameSystemId)
  const conditionLabels = new Map(
    system.conditionTypes.map((condition) => [condition.id, condition.label])
  )
  const labels = new Map<string, string>()
  for (const sourceId of new Set(contributors.map((contributor) => contributor.sourceId))) {
    const label = await readContributorLabel(ctx, sourceId, conditionLabels)
    if (label) labels.set(sourceId, label)
  }
  return build(labelEncounterRollModeReasons(labels))
}
