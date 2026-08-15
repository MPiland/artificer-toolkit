import {
  createEncounterRepository,
  createRulePackRepository,
  type DBLike,
  type EncounterRecord,
  type EncounterRulesetRecord,
  type RulePackRecord,
  type RulePackRevisionRecord
} from '@artificer-toolkit/db'

import { EncounterValidationError } from './encounterErrors.js'

async function resolveRuleset(
  repository: ReturnType<typeof createEncounterRepository>,
  systemIds: Iterable<string | null>
): Promise<EncounterRulesetRecord> {
  const uniqueSystemIds = [
    ...new Set([...systemIds].filter((id): id is string => id !== null))
  ].sort()
  if (uniqueSystemIds.length === 0) {
    throw new EncounterValidationError(
      'Encounter actors must identify a game system before a rule pack can be selected.'
    )
  }

  const rulesets = await Promise.all(uniqueSystemIds.map((id) => repository.findRuleset(id)))
  if (rulesets.some((ruleset) => ruleset === null)) {
    throw new EncounterValidationError('An Encounter actor references an unavailable game system.')
  }
  const resolved = rulesets.filter((ruleset): ruleset is EncounterRulesetRecord => ruleset !== null)
  const identities = new Set(resolved.map((ruleset) => `${ruleset.code}\0${ruleset.version}`))
  if (identities.size !== 1) {
    throw new EncounterValidationError(
      'All system-backed actors in an Encounter must use the same ruleset and version.'
    )
  }
  return resolved[0]
}

export async function resolveActiveRulePackForSystems(
  db: DBLike,
  systemIds: Iterable<string | null>
): Promise<{
  pack: RulePackRecord
  revision: RulePackRevisionRecord
  ruleset: EncounterRulesetRecord
}> {
  const ruleset = await resolveRuleset(createEncounterRepository(db), systemIds)
  const rulePacks = createRulePackRepository(db)
  const revision = await rulePacks.findActiveByRuleset(ruleset.code, ruleset.version)
  if (!revision) {
    throw new EncounterValidationError(
      `No active rule pack exists for ${ruleset.code} ${ruleset.version}.`
    )
  }
  const pack = await rulePacks.getPack(revision.rulePackId)
  if (!pack) throw new EncounterValidationError('The active rule pack is unavailable.')
  return { pack, revision, ruleset }
}

export function encounterSystemIds(encounter: EncounterRecord): Array<string | null> {
  return encounter.actors.map((actor) => actor.systemId)
}

export async function requireCompatibleActiveRulePackRevision(
  db: DBLike,
  encounter: EncounterRecord,
  revisionId: string
): Promise<RulePackRevisionRecord> {
  const repositories = {
    encounters: createEncounterRepository(db),
    rulePacks: createRulePackRepository(db)
  }
  const ruleset = await resolveRuleset(repositories.encounters, encounterSystemIds(encounter))
  const requested = await repositories.rulePacks.getRevision(revisionId)
  if (!requested || requested.state !== 'ACTIVE') {
    throw new EncounterValidationError('The selected rule-pack revision is not active.')
  }
  const pack = await repositories.rulePacks.getPack(requested.rulePackId)
  if (!pack || pack.rulesetCode !== ruleset.code || pack.version !== ruleset.version) {
    throw new EncounterValidationError('The selected rule pack does not match this Encounter.')
  }
  const active = await repositories.rulePacks.findActiveByRuleset(ruleset.code, ruleset.version)
  if (active?.id !== requested.id) {
    throw new EncounterValidationError('The selected rule-pack revision is no longer active.')
  }
  return requested
}
