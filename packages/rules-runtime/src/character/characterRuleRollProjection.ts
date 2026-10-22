import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { modifierRollInfluence } from '@artificer-toolkit/shared/core'
import {
  compareCanonicalD20Contributors,
  rollModeContributorSourceOfMechanicSource
} from '@artificer-toolkit/shared/rules'

import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eAcceptedModifierApplicability,
  dnd5eFoldedModifierApplicability,
  dnd5eModifierApplies,
  dnd5eSaveRequiresSourceSight
} from '../systems/dnd5e/modifierApplicability.js'
import { resolveDnd5eRollMode } from '../systems/dnd5e/rollModePolicy.js'

type CharacterRollMode = CharacterRulePolicyOutput['rollModes']['initiative']

type CharacterRollContributor =
  CharacterRulePolicyOutput['rollContributorEvidence']['initiative'][number]

/** A save against one authored rule or one condition, which adds the grants scoped to it. */
type ScopedSavingThrow = {
  abilityId: string
  scope: { ruleDefinitionId: string } | { conditionTypeId: string }
  /** Each group's roll influence, or null for a bonus or penalty. */
  groups: Map<string, string | null>
}

function scopedSavingThrows(output: CharacterRulePolicyOutput): ScopedSavingThrow[] {
  const scoped = new Map<string, ScopedSavingThrow>()
  for (const modifier of output.grantFold.modifiers) {
    const influence = modifierRollInfluence(modifier)
    if (
      (modifier.modifierKind !== 'BONUS' &&
        modifier.modifierKind !== 'PENALTY' &&
        influence === null) ||
      !dnd5eModifierApplies(
        dnd5eAcceptedModifierApplicability(modifier),
        DND5E_CHARACTER_WIDE_TARGET
      )
    )
      continue
    const { domain } = modifier
    const abilityId = domain.ability
    if (dnd5eSaveRequiresSourceSight(modifier)) continue
    if (modifier.valueDomainCode !== 'SAVING_THROW_MODIFIER' || abilityId === undefined) continue
    const ruleDefinitionId = postgresUuidSchema.safeParse(domain.ruleDefinitionId)
    const conditionTypeId = postgresUuidSchema.safeParse(domain.conditionTypeId)
    const scope = ruleDefinitionId.success
      ? { ruleDefinitionId: ruleDefinitionId.data }
      : conditionTypeId.success
        ? { conditionTypeId: conditionTypeId.data }
        : null
    if (scope === null) continue
    const key = `${abilityId}:${JSON.stringify(scope)}`
    const entry = scoped.get(key) ?? { abilityId, scope, groups: new Map() }
    entry.groups.set(modifier.domainKey, influence)
    scoped.set(key, entry)
  }
  return [...scoped.values()]
}

function canonicalizeRollContributors(
  contributors: readonly CharacterRollContributor[]
): CharacterRollContributor[] {
  const ordered = [...contributors].sort(compareCanonicalD20Contributors)
  for (let index = 1; index < ordered.length; index += 1) {
    const prior = ordered[index - 1]!
    const current = ordered[index]!
    if (
      prior.sourceId === current.sourceId &&
      prior.grantId === current.grantId &&
      prior.domainKey === current.domainKey &&
      prior.influence === current.influence
    ) {
      throw new Error('Character saving-throw contributors must be unique.')
    }
  }
  return ordered
}

function resolveRollMode(
  contributors: CharacterRulePolicyOutput['rollContributorEvidence']['initiative']
): CharacterRollMode {
  return resolveDnd5eRollMode(contributors).rollMode
}

function resolveRollModeRecord<T extends Record<string, readonly { influence: string }[]>>(
  contributors: T
): { [Key in keyof T]: CharacterRollMode } {
  return Object.fromEntries(
    Object.entries(contributors).map(([key, values]) => [
      key,
      resolveDnd5eRollMode(values).rollMode
    ])
  ) as { [Key in keyof T]: CharacterRollMode }
}

/**
 * System policy qualifies private contributors. Scalar modes emitted by the
 * transitional model contract are overwritten here and are never authoritative.
 */
export function resolveCharacterRulePolicyRollModes(
  output: CharacterRulePolicyOutput,
  vocabularySnapshot?: Pick<SystemVocabularySnapshot, 'document'>
): CharacterRulePolicyOutput {
  const contributors = output.rollContributorEvidence
  const savingThrowContributors = Object.fromEntries(
    Object.entries(contributors.savingThrows).map(([abilityId, values]) => [
      abilityId,
      canonicalizeRollContributors(values)
    ])
  ) as CharacterRulePolicyOutput['rollContributorEvidence']['savingThrows']
  const canonicalContributors = {
    ...contributors,
    savingThrows: savingThrowContributors
  }
  const rollModes = {
    initiative: resolveRollMode(canonicalContributors.initiative),
    abilityChecks: resolveRollModeRecord(canonicalContributors.abilityChecks),
    savingThrows: resolveRollModeRecord(canonicalContributors.savingThrows),
    skillChecks: resolveRollModeRecord(canonicalContributors.skillChecks),
    attacks: resolveRollModeRecord(canonicalContributors.attacks)
  }
  const derivedSavingThrows = output.derivedStats.savingThrows
  const abilityDefinitions = vocabularySnapshot?.document.abilities ?? []
  if (derivedSavingThrows.length > 0 && abilityDefinitions.length === 0) {
    throw new Error(
      'Character saving throws require a System vocabulary snapshot with ability definitions.'
    )
  }
  const savingThrowDefinitions: CharacterRulePolicyOutput['savingThrowDefinitions'] =
    derivedSavingThrows.map((savingThrow) => {
      const matches = abilityDefinitions.filter((ability) => ability.code === savingThrow.abilityId)
      if (matches.length !== 1) {
        throw new Error(
          `Character saving throw "${savingThrow.abilityId}" has no exact System ability definition.`
        )
      }
      const abilityDefinition = matches[0]!
      const rollMode =
        rollModes.savingThrows[savingThrow.abilityId as keyof typeof rollModes.savingThrows]
      const savingThrowEvidence =
        canonicalContributors.savingThrows[
          savingThrow.abilityId as keyof typeof contributors.savingThrows
        ]
      if (!rollMode || !savingThrowEvidence) {
        throw new Error(
          `Character saving throw "${savingThrow.abilityId}" lacks normalized roll evidence.`
        )
      }
      return {
        abilityDefinitionId: abilityDefinition.id,
        modifier: savingThrow.total.effective,
        rollMode,
        contributors: savingThrowEvidence
      }
    })
  const resolvedModifierGroups = new Map(
    output.modifierGroups.map((group) => [group.domainKey, group])
  )
  for (const scoped of scopedSavingThrows(output)) {
    const base = savingThrowDefinitions.find(
      (savingThrow) =>
        abilityDefinitions.find((ability) => ability.id === savingThrow.abilityDefinitionId)
          ?.code === scoped.abilityId
    )
    if (!base) continue
    let modifier = base.modifier
    const scopedContributors: CharacterRollContributor[] = []
    for (const [domainKey, influence] of scoped.groups) {
      const group = resolvedModifierGroups.get(domainKey)
      if (!group) continue
      const contributions = group.contributions.filter((contribution) =>
        dnd5eModifierApplies(
          dnd5eFoldedModifierApplicability(output.grantFold, contribution),
          DND5E_CHARACTER_WIDE_TARGET
        )
      )
      if (influence === null) {
        modifier += contributions
          .filter((contribution) => contribution.state === 'APPLIED')
          .reduce((sum, contribution) => sum + contribution.value, 0)
        continue
      }
      for (const contribution of contributions) {
        if (!contribution.source || !contribution.grantId || !contribution.domainKey)
          throw new Error('Scoped character saving throws require contributor provenance.')
        scopedContributors.push({
          sourceId: contribution.sourceId,
          source: rollModeContributorSourceOfMechanicSource(contribution.source),
          grantId: contribution.grantId,
          domainKey: contribution.domainKey,
          influence
        })
      }
    }
    const contributors = canonicalizeRollContributors([...base.contributors, ...scopedContributors])
    savingThrowDefinitions.push({
      abilityDefinitionId: base.abilityDefinitionId,
      ...scoped.scope,
      modifier,
      rollMode: resolveRollMode(contributors),
      contributors
    })
  }
  const scopeKey = (savingThrow: (typeof savingThrowDefinitions)[number]) =>
    `${savingThrow.ruleDefinitionId ?? ''}:${savingThrow.conditionTypeId ?? ''}`
  if (
    new Set(
      savingThrowDefinitions.map(
        (savingThrow) => `${savingThrow.abilityDefinitionId}:${scopeKey(savingThrow)}`
      )
    ).size !== savingThrowDefinitions.length
  ) {
    throw new Error(
      'Character saving throws must map to unique System ability, rule and condition definitions.'
    )
  }
  return {
    ...output,
    rollContributorEvidence: canonicalContributors,
    rollModes,
    savingThrowDefinitions: savingThrowDefinitions.sort((left, right) =>
      left.abilityDefinitionId === right.abilityDefinitionId
        ? scopeKey(left).localeCompare(scopeKey(right))
        : left.abilityDefinitionId.localeCompare(right.abilityDefinitionId)
    )
  }
}
