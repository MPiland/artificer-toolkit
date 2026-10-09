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
import {
  DND5E_ABILITY_DEFINITION_ID_BY_CODE,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID
} from './systems/dnd5e/identity.js'

/** A grant a holder carries from an Active Effect, in the Character grant fold's modifier shape. */
export type EncounterActiveGrant = {
  effectId: string
  modifiers: readonly CharacterGrantFoldModifier[]
}

export function listEncounterActiveGrants(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
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

/**
 * The capabilities a holder's active grants switch off: a `REACTION_COUNT SET_VALUE 0` grant
 * (Shocking Grasp's "can't take reactions") suppresses its reaction allowance, so it is offered no
 * reaction while the grant lasts (D99).
 */
export function encounterActiveGrantCapabilitySuppressions(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
) {
  return listEncounterActiveGrants(effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) =>
      modifier.valueDomainCode === 'REACTION_COUNT' &&
      modifier.modifierKind === 'SET_VALUE' &&
      record(record(modifier.grant)?.payload)?.amount === 0
        ? [
            {
              activeEffectId: effectId,
              contributionId: modifier.grantId,
              capabilityDefinitionIds: [DND5E_REACTION_ALLOWANCE_DEFINITION_ID]
            }
          ]
        : []
    )
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

/**
 * A Creature holder's armor class with its active fixed armor-class bonuses and penalties
 * (Shimmering Shield's +2) added to its stat block value. A Character folds the same grants
 * through its own policy instead.
 */
export function withCreatureActiveGrantArmorClass(
  armorClass: number | null,
  effects: readonly ActiveRuleEffectRecord[]
): number | null {
  if (armorClass === null) return null
  let adjusted = armorClass
  for (const { modifiers } of listEncounterActiveGrants(effects)) {
    for (const modifier of modifiers) {
      const grant = record(modifier.grant)
      if (
        modifier.valueDomainCode !== 'ARMOR_CLASS' ||
        (modifier.modifierKind !== 'BONUS' && modifier.modifierKind !== 'PENALTY') ||
        grant?.scope !== 'GLOBAL'
      )
        continue
      const payload = record(grant.payload)
      if (payload?.valueKind !== 'FIXED' || typeof payload.amount !== 'number')
        throw new Error('A Creature armor class grant must be a fixed amount.')
      // A penalty is authored as a positive amount and subtracted once, here.
      adjusted += modifier.modifierKind === 'PENALTY' ? -payload.amount : payload.amount
    }
  }
  return adjusted
}
