import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type {
  CharacterInitiativeActorFacts,
  CharacterMechanicsProjection
} from '@artificer-toolkit/schema/projections/characterMechanics'

/** A System check's code as the Character rule policy keys its skills. */
function policySkillId(code: string) {
  return code.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-')
}

/** The Character rule policy's skill key for a System check definition, when it is a skill. */
export function characterCheckSkillId(
  registry: CharacterAssemblyRegistry | CharacterMechanicsProjection['ruleRegistry'] | undefined,
  checkDefinitionId: string
): string | null {
  const check = (registry as CharacterAssemblyRegistry | undefined)?.system?.skills?.find(
    ({ id }) => id === checkDefinitionId
  )
  return check?.code ? policySkillId(check.code) : null
}

/**
 * Extracts exact actor facts from the same compiled authored snapshot that is
 * pinned into a Character mechanics projection. The shared engine carries
 * only these codes; a System policy decides whether a given property or size
 * has mechanical significance.
 */
export function toCharacterInitiativeActorFacts(input: {
  snapshot: CharacterBuildSnapshot | CharacterMechanicsProjection['ruleSnapshot']
  registry: CharacterAssemblyRegistry | CharacterMechanicsProjection['ruleRegistry']
  rulePolicyOutput: CharacterRulePolicyOutput
}): CharacterInitiativeActorFacts {
  if (!('totalLevel' in input.snapshot)) {
    // Historical compact rule snapshots intentionally do not carry the
    // source facts. They remain readable but cannot authorize declared-action
    // initiative without a freshly compiled Character projection.
    return { effectiveSize: null, checkTotals: {}, equippedItems: [] }
  }
  const registry = input.registry as CharacterAssemblyRegistry
  const checkTotals: Record<string, number> = {}
  if (registry.system) {
    const skillsById = new Map<
      string,
      CharacterRulePolicyOutput['derivedStats']['skills'][number]
    >()
    for (const skill of input.rulePolicyOutput.derivedStats.skills) {
      if (skillsById.has(skill.skillId)) {
        throw new Error(`Character rule policy produced duplicate skill "${skill.skillId}".`)
      }
      skillsById.set(skill.skillId, skill)
    }
    const abilitiesById = new Map<string, string>()
    for (const ability of registry.system.abilities ?? []) {
      if (!ability.code || abilitiesById.has(ability.id)) {
        throw new Error(`System ability definition "${ability.id}" is ambiguous.`)
      }
      abilitiesById.set(ability.id, ability.code)
    }
    const checkIds = new Set<string>()
    const checkSkillIds = new Set<string>()
    for (const check of [...(registry.system.skills ?? [])].sort((left, right) =>
      left.id.localeCompare(right.id)
    )) {
      if (check.governingAbilityDefinitionId === null) continue
      if (!check.governingAbilityDefinitionId) {
        throw new Error(`System check definition "${check.id}" has no governing ability.`)
      }
      const governingAbility = abilitiesById.get(check.governingAbilityDefinitionId)
      const skillId = check.code ? policySkillId(check.code) : undefined
      const skill = skillId ? skillsById.get(skillId) : undefined
      if (
        !skillId ||
        !skill ||
        !governingAbility ||
        checkIds.has(check.id) ||
        checkSkillIds.has(skillId) ||
        skill.governingAbility.effective !== governingAbility
      ) {
        throw new Error(
          `System check definition "${check.id}" does not match Character rule policy.`
        )
      }
      checkIds.add(check.id)
      checkSkillIds.add(skillId)
      checkTotals[check.id] = skill.total.effective
    }
    if (checkSkillIds.size !== skillsById.size) {
      throw new Error(
        'Character rule policy skills do not map one-to-one to System check definitions.'
      )
    }
  }
  const raceId = input.snapshot.subraceId ?? input.snapshot.raceId
  const effectiveSize = raceId ? (registry.races[raceId]?.size ?? null) : null
  const equippedItems = input.snapshot.equipmentItems
    .filter((item) => item.equippedState !== undefined)
    .map((item) => ({
      itemInstanceId: item.instanceId,
      equipmentDefinitionId: item.contentRef.definitionId,
      properties: [...new Set(item.compiledItem.properties ?? [])].sort()
    }))
    .sort((left, right) => left.itemInstanceId.localeCompare(right.itemInstanceId))
  return { effectiveSize, checkTotals, equippedItems }
}
