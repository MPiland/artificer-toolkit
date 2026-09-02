import {
  createActiveRuleEffectRepository,
  createSystemVocabularySnapshotRepository,
  type DBLike,
  type EncounterActorRecord
} from '@artificer-toolkit/db'
import {
  type CharacterRulePolicyOutput,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import { encounterCreatureRuleFactsSnapshotSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { ResolvedCampaignCharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/campaignCharacterMechanics'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'

import { resolveCharacterRulePolicyRollModes } from '../character/characterRuleEvaluation.js'
import { evaluateRuleRevision } from '../rules/ruleRevisionRuntime.js'
import { EncounterConflictError } from './encounterErrors.js'

export function characterBaseScalarValues(input: {
  mechanics: CharacterMechanicsProjection
  overlay: ResolvedCampaignCharacterMechanicsProjection
}): Record<string, number> {
  const values: Record<string, number> = {}
  for (const ability of input.overlay.rulePolicyOutput.derivedStats.abilities) {
    const definitions = input.mechanics.rulePolicyInput.abilityDefinitions.filter(
      (definition) => definition.code === ability.abilityId
    )
    const definition = definitions[0]
    const value = ability.score.effective
    if (definitions.length !== 1 || !definition || !Number.isSafeInteger(value) || value < 0)
      throw new EncounterConflictError('The Character ability fact is stale.')
    values[definition.id] = value
  }
  return values
}

export function scalarValuesDiffer(
  base: Readonly<Record<string, number>>,
  effective: Readonly<Record<string, number>>
): boolean {
  const keys = Object.keys(base)
  return (
    keys.length !== Object.keys(effective).length ||
    keys.some((key) => base[key] !== effective[key])
  )
}

export function foldActiveScalarReductions(input: {
  baseScalarValues: Readonly<Record<string, number>>
  effects: Awaited<ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['lockByOwner']>>
}): Record<string, number> {
  const effective = { ...input.baseScalarValues }
  for (const effect of [...input.effects].sort(
    (left, right) => left.createdOrdinal - right.createdOrdinal || left.id.localeCompare(right.id)
  )) {
    if (effect.definition.schemaVersion !== 2) continue
    for (const contribution of effect.definition.stateContributions) {
      if (contribution.kind !== 'SCALAR_REDUCTION') continue
      const current = effective[contribution.valueDefinitionId]
      if (!Number.isSafeInteger(current) || current < 0)
        throw new EncounterConflictError('The scalar reduction target fact is unavailable.')
      effective[contribution.valueDefinitionId] = Math.max(
        contribution.floor,
        current - contribution.amount
      )
    }
  }
  return effective
}

export function hasActiveScalarReduction(
  effects: Awaited<ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['lockByOwner']>>
): boolean {
  return effects.some(
    (effect) =>
      effect.definition.schemaVersion === 2 &&
      effect.definition.stateContributions.some(
        (contribution) => contribution.kind === 'SCALAR_REDUCTION'
      )
  )
}

export function encounterActorBaseScalarValues(
  actor: EncounterActorRecord
): Record<string, number> {
  if (
    actor.kind !== 'CREATURE' ||
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  ) {
    return {}
  }
  const parsed = encounterCreatureRuleFactsSnapshotSchema.safeParse(actor.snapshot.ruleFacts)
  if (!parsed.success || parsed.data.gameSystemId !== actor.systemId)
    throw new EncounterConflictError('The Encounter actor scalar facts are stale.')
  return { ...parsed.data.abilityScores }
}

export async function evaluateEffectiveCharacterPolicy(input: {
  db: DBLike
  character: {
    mechanics: CharacterMechanicsProjection
    overlay: ResolvedCampaignCharacterMechanicsProjection
    systemId: string
  }
  baseScalarValues: Readonly<Record<string, number>>
  effectiveScalarValues: Readonly<Record<string, number>>
}): Promise<CharacterRulePolicyOutput> {
  const facts =
    input.character.overlay.kind === 'MATERIALIZED'
      ? input.character.overlay.rulePolicyInput
      : input.character.mechanics.rulePolicyInput
  const abilities = facts.derivedBaseFacts.abilities.map((ability) => {
    const effective = input.effectiveScalarValues[ability.abilityId]
    const base = input.baseScalarValues[ability.abilityId]
    if (effective === undefined || base === undefined || effective === base) return ability
    return {
      ...ability,
      bonuses: [
        ...ability.bonuses,
        {
          kind: 'FIXED' as const,
          sourceId: `scalar-reduction:${ability.abilityId}`,
          source: { kind: 'SYSTEM' as const, systemId: input.character.systemId },
          value: effective,
          operation: 'SET' as const
        }
      ]
    }
  })
  const evaluated = await evaluateRuleRevision({
    db: input.db,
    revisionId: input.character.mechanics.ruleRevisionId,
    modelKey: 'character-policy',
    contractKey: 'character-policy',
    normalizedFacts: { ...facts, derivedBaseFacts: { ...facts.derivedBaseFacts, abilities } }
  })
  const vocabulary = await createSystemVocabularySnapshotRepository(input.db).findById(
    input.character.mechanics.systemVocabularySnapshotId
  )
  if (
    !vocabulary ||
    vocabulary.systemId !== input.character.systemId ||
    vocabulary.snapshotVersion !== input.character.mechanics.systemVocabularySnapshotVersion ||
    vocabulary.checksum !== input.character.mechanics.systemVocabularySnapshotChecksum
  ) {
    throw new EncounterConflictError('The Character System vocabulary snapshot is stale.')
  }
  return resolveCharacterRulePolicyRollModes(
    characterRulePolicyOutputSchema.parse(evaluated.result),
    vocabulary
  )
}
