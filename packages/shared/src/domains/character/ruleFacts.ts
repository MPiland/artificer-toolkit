import type { CharacterAssemblyRegistry, CharacterAssemblyRegistrySystem } from './ruleRegistry.js'

export type ParsedModifierDomainKey = {
  valueDomainCode: string
  modifierKind: string
  params: Record<string, string>
}

function toSkillCanonicalId(value: string): string {
  return value.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-')
}

export function resolveSkillAlias(subjectId: string, skillAliases: Map<string, string>): string {
  if (skillAliases.has(subjectId)) return skillAliases.get(subjectId) ?? subjectId
  const lower = subjectId.toLowerCase()
  if (skillAliases.has(lower)) return skillAliases.get(lower) ?? subjectId

  const normalized = toSkillCanonicalId(subjectId)
  if (skillAliases.has(normalized)) return skillAliases.get(normalized) ?? subjectId
  if (skillAliases.has(normalized.toUpperCase())) {
    return skillAliases.get(normalized.toUpperCase()) ?? subjectId
  }

  return subjectId
}

export function buildSkillSubjectAliasMap(
  system: CharacterAssemblyRegistry['system']
): Map<string, string> {
  const aliases = new Map<string, string>()

  for (const skill of system?.skills ?? []) {
    const canonical = toSkillCanonicalId(skill.code ?? '')
    if (!canonical) throw new Error(`System check definition "${skill.id}" has no code.`)
    for (const alias of [skill.id, skill.code, skill.code?.toUpperCase(), canonical]) {
      if (!alias) continue
      const existing = aliases.get(alias)
      if (existing && existing !== canonical) {
        throw new Error(`System check alias "${alias}" is ambiguous.`)
      }
      aliases.set(alias, canonical)
    }
  }
  return aliases
}

/**
 * The skills of a current System document with the ability each is governed by, in id order, by
 * canonical skill code. A skill the System leaves ungoverned is omitted; a skill whose mapping the
 * System cannot resolve is an error.
 */
export function resolveSystemSkillAbilities(system: CharacterAssemblyRegistrySystem) {
  const abilityCodesById = new Map<string, string>()
  for (const ability of system.abilities ?? []) {
    if (!ability.code || abilityCodesById.has(ability.id)) {
      throw new Error(`System ability definition "${ability.id}" is ambiguous.`)
    }
    abilityCodesById.set(ability.id, ability.code)
  }
  const canonicalIds = new Set<string>()
  return [...(system.skills ?? [])]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((skill) => {
      if (skill.governingAbilityDefinitionId === null) return []
      if (!skill.governingAbilityDefinitionId) {
        throw new Error(`System check definition "${skill.id}" has no governing ability.`)
      }
      const { code } = skill
      const canonicalId = code ? toSkillCanonicalId(code) : undefined
      const abilityCode = abilityCodesById.get(skill.governingAbilityDefinitionId)
      if (!code || !canonicalId || !abilityCode || canonicalIds.has(canonicalId)) {
        throw new Error(`System check definition "${skill.id}" has an invalid mapping.`)
      }
      canonicalIds.add(canonicalId)
      return [{ skill, code, canonicalId, abilityCode }]
    })
}

export function buildModifierDomainKey(
  valueDomainCode: string,
  modifierKind: string,
  domain?: Record<string, unknown>
): string {
  const entries = Object.entries(domain ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))

  if (entries.length === 0) return `${valueDomainCode}:${modifierKind}`

  const paramKey = entries.map(([key, value]) => `${key}=${String(value)}`).join('|')
  return `${valueDomainCode}:${modifierKind}|${paramKey}`
}

export function parseModifierDomainKey(domainKey: string): ParsedModifierDomainKey {
  const [head, ...paramParts] = domainKey.split('|')
  const [valueDomainCode = 'UNKNOWN', modifierKind = 'BONUS'] = head.split(':')
  const params = Object.fromEntries(
    paramParts
      .map((part) => {
        const separator = part.indexOf('=')
        if (separator < 0) return null
        return [part.slice(0, separator), part.slice(separator + 1)]
      })
      .filter((entry): entry is [string, string] => entry !== null)
  )

  return { valueDomainCode, modifierKind, params }
}
