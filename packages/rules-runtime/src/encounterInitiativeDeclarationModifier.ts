import type { InitiativeDeclarationModifiersDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { InitiativeDeclarationFactsDto } from '@artificer-toolkit/schema/shared/initiativeState'

type DeclaredSource = InitiativeDeclarationFactsDto['primary']

/**
 * The modifier a declared-action policy's authored numbers give one declaration: the actor size's
 * modifier, each factor once when a declared action's equipment carries every property of one of
 * its sets (or the GM picked it), and the highest declared spell level times the per-level modifier.
 * Null when the policy authors no modifier for the actor's size.
 */
export function initiativeDeclarationModifier(
  modifiers: InitiativeDeclarationModifiersDto,
  declaration: InitiativeDeclarationFactsDto
): number | null {
  const size = modifiers.sizes.find((entry) => entry.size === declaration.actorSize)
  if (!size) return null
  const sources = [declaration.primary, declaration.bonus].filter(
    (source): source is DeclaredSource => source !== null
  )
  const factors = modifiers.factors.filter((factor) =>
    sources.some((source) =>
      source.kind === 'GM_ADJUDICATED'
        ? source.factorIds.includes(factor.id)
        : source.kind === 'CHARACTER_ACTION' &&
          factor.equipmentPropertySets.some((set) =>
            set.every((property) => source.equipmentProperties.includes(property))
          )
    )
  )
  const spellLevels = sources.flatMap((source) =>
    source.kind === 'CHARACTER_SPELL_CAST'
      ? [source.castLevel]
      : source.kind === 'GM_ADJUDICATED' && source.spellLevel !== null
        ? [source.spellLevel]
        : []
  )
  const spellLevel = spellLevels.length > 0 ? Math.max(...spellLevels) : 0
  return (
    size.modifier +
    factors.reduce((total, factor) => total + factor.modifier, 0) +
    spellLevel * modifiers.spellLevel.modifierPerLevel
  )
}
