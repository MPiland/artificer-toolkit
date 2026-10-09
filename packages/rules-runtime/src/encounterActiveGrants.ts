import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldSource
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import { resolveD20Contributors } from '@artificer-toolkit/shared/rolls'
import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules'

import { normalizeCharacterGrantRestrictions } from './character/characterGrantFoldRestrictionFacts.js'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import { DND5E_ABILITY_DEFINITION_ID_BY_CODE } from './systems/dnd5e/identity.js'

/** A grant a holder carries from an Active Effect, in the Character grant fold's modifier shape. */
export type EncounterActiveGrant = {
  effectId: string
  modifiers: readonly CharacterGrantFoldModifier[]
}

export function listEncounterActiveGrants(
  effects: readonly ActiveRuleEffectRecord[]
): EncounterActiveGrant[] {
  return effects.flatMap(({ id, definition }) =>
    definition.schemaVersion === 2
      ? definition.stateContributions.flatMap((contribution) =>
          contribution.kind === 'MODIFIER_GRANT'
            ? [{ effectId: id, modifiers: contribution.modifiers }]
            : []
        )
      : []
  )
}

/** The Character grant fold's `ACTIVE_EFFECT` sources for the holder's grants. */
function encounterActiveGrantFoldSources(
  effects: readonly ActiveRuleEffectRecord[]
): CharacterGrantFoldSource[] {
  return listEncounterActiveGrants(effects).map(({ effectId, modifiers }) => {
    const mechanicSource = { kind: 'ACTIVE_EFFECT', activeEffectId: effectId } as const
    return {
      sourceId: createCharacterMechanicSourceKey(mechanicSource),
      mechanicSource,
      sourceState: null,
      restrictions: normalizeCharacterGrantRestrictions(undefined),
      proficiencies: [],
      senses: [],
      modifiers: [...modifiers],
      feats: [],
      spells: []
    }
  })
}

/**
 * The Character's policy facts with the holder's Active Effect grants folded as sources; the same
 * facts object when the holder carries none.
 */
export function withCharacterActiveGrants(
  facts: CharacterRulePolicyInput,
  effects: readonly ActiveRuleEffectRecord[]
): CharacterRulePolicyInput {
  const activeEffects = encounterActiveGrantFoldSources(effects)
  return activeEffects.length
    ? { ...facts, grantFoldFacts: { ...facts.grantFoldFacts, activeEffects } }
    : facts
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Adds a Creature holder's active saving-throw grants scoped to a condition (Antitoxin against
 * poison) as condition-scoped save rows beside its base ones, so a save against that condition
 * reads them. A Character folds the same grants through its own policy instead.
 */
export function withCreatureActiveGrantSaves(
  savingThrowDefinitions: readonly unknown[],
  holderActorId: string,
  effects: readonly ActiveRuleEffectRecord[]
): unknown[] {
  const scoped = new Map<
    string,
    {
      abilityDefinitionId: string
      conditionTypeId: string
      contributors: EncounterRelationshipD20Contributor[]
    }
  >()
  for (const { effectId, modifiers } of listEncounterActiveGrants(effects)) {
    for (const modifier of modifiers) {
      const domain = record(modifier.domain)
      const abilityDefinitionId = DND5E_ABILITY_DEFINITION_ID_BY_CODE[String(domain?.ability)]
      const conditionTypeId = domain?.conditionTypeId
      if (
        (modifier.modifierKind !== 'ADVANTAGE' && modifier.modifierKind !== 'DISADVANTAGE') ||
        modifier.valueDomainCode !== 'SAVING_THROW_MODIFIER' ||
        abilityDefinitionId === undefined ||
        typeof conditionTypeId !== 'string' ||
        record(modifier.grant)?.scope !== 'GLOBAL'
      )
        continue
      const key = `${abilityDefinitionId}:${conditionTypeId}`
      const entry = scoped.get(key) ?? { abilityDefinitionId, conditionTypeId, contributors: [] }
      entry.contributors.push({
        sourceId: createCharacterMechanicSourceKey({
          kind: 'ACTIVE_EFFECT',
          activeEffectId: effectId
        }),
        grantId: modifier.grantId,
        domainKey: `active-grant:${holderActorId}`,
        influence: modifier.modifierKind
      })
      scoped.set(key, entry)
    }
  }
  return [
    ...savingThrowDefinitions,
    ...[...scoped.values()].flatMap(({ abilityDefinitionId, conditionTypeId, contributors }) => {
      const base = savingThrowDefinitions.find((definition) => {
        const row = record(definition)
        return (
          row?.abilityDefinitionId === abilityDefinitionId &&
          row.conditionTypeId === undefined &&
          row.ruleDefinitionId === undefined
        )
      })
      const row = record(base)
      if (!row || typeof row.modifier !== 'number' || !Array.isArray(row.contributors)) return []
      const merged = [
        ...(row.contributors as EncounterRelationshipD20Contributor[]),
        ...contributors
      ]
        .sort(compareCanonicalD20Contributors)
        .filter(
          (contributor, index, sorted) =>
            index === 0 || compareCanonicalD20Contributors(sorted[index - 1]!, contributor) !== 0
        )
      return [
        {
          abilityDefinitionId,
          conditionTypeId,
          modifier: row.modifier,
          rollMode: resolveD20Contributors(merged).rollMode,
          contributors: merged
        }
      ]
    })
  ]
}
