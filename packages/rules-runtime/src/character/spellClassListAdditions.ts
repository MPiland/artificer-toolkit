import type { CompiledFeature } from '@artificer-toolkit/shared/compilers'
import {
  SPELL_GRANT_ACCESS,
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

export type SpellClassListAddition = { spellIds: readonly string[]; classIds: readonly string[] }

/**
 * The spells the class-list-only grants of these features add to class spell lists (D175), for a
 * source at `classLevel`. A grant joins a list without making the spell a cast, so it is read here
 * and never becomes a spell access candidate.
 */
export function collectSpellClassListAdditions(
  features: readonly Pick<CompiledFeature, 'availableAtLevel' | 'spells'>[] | undefined,
  classLevel: number
): SpellClassListAddition[] {
  return (features ?? []).flatMap((feature) =>
    (feature.availableAtLevel ?? 1) > classLevel
      ? []
      : (feature.spells ?? []).flatMap((grant) =>
          grant.access === SPELL_GRANT_ACCESS.CLASS_LIST_ONLY &&
          grant.scalingKind === 'NONE' &&
          grant.authoringModeKind === 'SELECTED'
            ? [{ spellIds: grant.spellIds, classIds: grant.classListIds ?? [] }]
            : []
        )
  )
}

/** The additions of the class and subclass features a Character's build has reached. */
export function buildCharacterSpellClassListAdditions(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): SpellClassListAddition[] {
  return snapshot.classes.flatMap((classEntry) => [
    ...collectSpellClassListAdditions(
      registry.classes[classEntry.classId]?.features,
      classEntry.level
    ),
    ...collectSpellClassListAdditions(
      classEntry.subclassId ? registry.classes[classEntry.subclassId]?.features : undefined,
      classEntry.level
    )
  ])
}

/** The one merge of class-list additions into a spell catalog; Builder choices and the Sheet read it. */
export function withClassListAdditions<T extends { id: string; classIds: readonly string[] }>(
  spells: readonly T[],
  additions: readonly SpellClassListAddition[]
): T[] {
  if (additions.length === 0) return [...spells]
  return spells.map((spell) => {
    const joined = additions.flatMap((addition) =>
      addition.spellIds.includes(spell.id) ? addition.classIds : []
    )
    return joined.length === 0
      ? spell
      : { ...spell, classIds: [...new Set([...spell.classIds, ...joined])] }
  })
}
