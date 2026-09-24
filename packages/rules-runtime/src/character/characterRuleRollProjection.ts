import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules'
import { resolveD20Contributors } from '@artificer-toolkit/shared/rolls'

type CharacterRollMode = CharacterRulePolicyOutput['rollModes']['initiative']

type CharacterRollContributor =
  CharacterRulePolicyOutput['rollContributorEvidence']['initiative'][number]

type ScopedSavingThrow = {
  abilityId: string
  ruleDefinitionId: string
  groups: Map<string, 'BONUS' | 'PENALTY' | 'ADVANTAGE' | 'DISADVANTAGE'>
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function scopedSavingThrows(output: CharacterRulePolicyOutput): ScopedSavingThrow[] {
  const scoped = new Map<string, ScopedSavingThrow>()
  for (const modifier of output.grantFold.modifiers) {
    if (
      modifier.modifierKind !== 'BONUS' &&
      modifier.modifierKind !== 'PENALTY' &&
      modifier.modifierKind !== 'ADVANTAGE' &&
      modifier.modifierKind !== 'DISADVANTAGE'
    )
      continue
    const grant = record(modifier.grant)
    const domain = record(grant?.domain)
    const abilityId = domain?.ability
    const ruleDefinitionId = domain?.ruleDefinitionId
    if (
      grant?.valueDomainCode !== 'SAVING_THROW_MODIFIER' ||
      typeof abilityId !== 'string' ||
      typeof ruleDefinitionId !== 'string'
    )
      continue
    if (domain?.conditionTypeId != null) continue
    const parsedRuleDefinitionId = postgresUuidSchema.safeParse(ruleDefinitionId)
    if (!parsedRuleDefinitionId.success) continue
    const canonicalRuleDefinitionId = parsedRuleDefinitionId.data
    const key = `${abilityId}:${canonicalRuleDefinitionId}`
    const entry = scoped.get(key) ?? {
      abilityId,
      ruleDefinitionId: canonicalRuleDefinitionId,
      groups: new Map()
    }
    entry.groups.set(modifier.domainKey, modifier.modifierKind)
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
  return resolveD20Contributors(contributors).rollMode
}

function resolveRollModeRecord<
  T extends Record<string, readonly { influence: 'ADVANTAGE' | 'DISADVANTAGE' }[]>
>(contributors: T): { [Key in keyof T]: CharacterRollMode } {
  return Object.fromEntries(
    Object.entries(contributors).map(([key, values]) => [
      key,
      resolveD20Contributors(values).rollMode
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
  const abilityDefinitions =
    vocabularySnapshot && 'abilities' in vocabularySnapshot.document
      ? vocabularySnapshot.document.abilities
      : []
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
    for (const [domainKey, modifierKind] of scoped.groups) {
      const group = resolvedModifierGroups.get(domainKey)
      if (!group) continue
      if (modifierKind === 'BONUS' || modifierKind === 'PENALTY') {
        modifier += group.effective
        continue
      }
      if (group.effective !== 1) continue
      for (const contribution of group.contributions) {
        if (!contribution.source || !contribution.grantId || !contribution.domainKey)
          throw new Error('Scoped character saving throws require contributor provenance.')
        scopedContributors.push({
          sourceId: contribution.sourceId,
          source: contribution.source,
          grantId: contribution.grantId,
          domainKey: contribution.domainKey,
          influence: modifierKind
        })
      }
    }
    const contributors = canonicalizeRollContributors([...base.contributors, ...scopedContributors])
    savingThrowDefinitions.push({
      abilityDefinitionId: base.abilityDefinitionId,
      ruleDefinitionId: scoped.ruleDefinitionId,
      modifier,
      rollMode: resolveRollMode(contributors),
      contributors
    })
  }
  if (
    new Set(
      savingThrowDefinitions.map(
        (savingThrow) => `${savingThrow.abilityDefinitionId}:${savingThrow.ruleDefinitionId ?? ''}`
      )
    ).size !== savingThrowDefinitions.length
  ) {
    throw new Error(
      'Character saving throws must map to unique System ability and rule definitions.'
    )
  }
  return {
    ...output,
    rollContributorEvidence: canonicalContributors,
    rollModes,
    savingThrowDefinitions: savingThrowDefinitions.sort((left, right) =>
      left.abilityDefinitionId === right.abilityDefinitionId
        ? (left.ruleDefinitionId ?? '').localeCompare(right.ruleDefinitionId ?? '')
        : left.abilityDefinitionId.localeCompare(right.abilityDefinitionId)
    )
  }
}
