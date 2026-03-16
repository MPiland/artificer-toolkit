import type { AssembledCharacterSpellAccess } from '@artificer-toolkit/shared'

import type { CharacterAssemblyInput } from './contract.js'

export function assembleCharacterSpellAccess(
  character: CharacterAssemblyInput
): AssembledCharacterSpellAccess[] {
  const spells: AssembledCharacterSpellAccess[] = []

  if (!character.intent.spellSelections) return spells

  for (const selection of character.intent.spellSelections) {
    for (const spellId of selection.spells) {
      spells.push({
        id: `${selection.id}:${spellId}`,
        spellId,
        source: selection.source,
        timing: selection.timing
      })
    }
  }

  return spells
}
