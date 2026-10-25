import type { Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'

type Entry = Dnd5eCompiledEffectActionSource['compiledEffect']['entries'][number]

/**
 * The action narrowed to each variant its entries author (a hit-point tier, a roll-table row), in
 * authored order: a variant keeps its own entries, as `own` rewrites them, and the entries no variant
 * owns ride every variant. Null for an action that authors no variant.
 */
export function narrowedActions<Key>(
  action: Dnd5eCompiledEffectActionSource,
  variantOf: (entry: Entry) => Key | undefined,
  own: (entry: Entry) => Entry
): { key: Key; narrowed: Dnd5eCompiledEffectActionSource }[] | null {
  const { entries } = action.compiledEffect
  const keys = [
    ...new Set(
      entries.flatMap((entry) => {
        const key = variantOf(entry)
        return key === undefined ? [] : [key]
      })
    )
  ]
  if (keys.length === 0) return null
  return keys.map((key) => ({
    key,
    narrowed: {
      ...action,
      compiledEffect: {
        ...action.compiledEffect,
        entries: entries.flatMap((entry) => {
          const variant = variantOf(entry)
          return variant === undefined ? [entry] : variant === key ? [own(entry)] : []
        })
      }
    }
  }))
}

/**
 * The action narrowed to each hit-point tier its entries author, with the entries no tier owns
 * (a success path's immunity) riding every tier; null for an action that authors no tier.
 */
export function hitPointTierActions(
  action: Dnd5eCompiledEffectActionSource
): { atMost: number; tierAction: Dnd5eCompiledEffectActionSource }[] | null {
  return (
    narrowedActions(
      action,
      (entry) => ('hitPointTier' in entry ? entry.hitPointTier?.atMost : undefined),
      (entry) => {
        if (!('hitPointTier' in entry)) return entry
        const { hitPointTier: _tier, ...untiered } = entry
        return untiered
      }
    )?.map(({ key, narrowed }) => ({ atMost: key, tierAction: narrowed })) ?? null
  )
}
