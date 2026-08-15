import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

export function buildCharacterSpellSlotRuleFacts(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): CharacterRulePolicyInput['spellcastingClasses'] {
  return snapshot.classes.flatMap(({ classId, level }) => {
    const spellcasting = registry.classes[classId]?.spellcasting
    if (!spellcasting?.spellLimits.length) return []

    return [
      {
        classId,
        classLevel: level,
        resetKind: spellcasting.charges?.resetKind ?? 'LONG_REST',
        spellLimits: spellcasting.spellLimits.map((limit) => ({
          classLevel: limit.classLevel,
          slots: limit.slots.map(({ spellLevel, slotCount }) => ({
            spellLevel,
            slotCount
          }))
        }))
      }
    ]
  })
}
