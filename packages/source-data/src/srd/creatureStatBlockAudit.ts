/** What the stat-block audit reads of an authored Creature Feature or legendary option. */
export type PrintedActionSource = {
  readonly label: string
  readonly effects?: readonly unknown[]
  readonly attackSlots?: unknown
  readonly actionReference?: unknown
  readonly options?: readonly { readonly effects?: readonly unknown[] }[]
}

/** The printed name of a Multiattack, including its form qualifier ("Multiattack (Vampire Form Only)"). */
export const isPrintedMultiattack = (name: string) => /^Multiattack\b/.test(name)

/**
 * Whether an authored source carries the mechanics its printed action needs: an Effect on itself or
 * on one of its options, or a named action it runs (D51 option B). A Multiattack needs attack slots
 * (D93): an Effect or closed rule on it does not count, and no description-only entry excuses it.
 */
export function printedActionHasMechanics(name: string, source: PrintedActionSource) {
  if (isPrintedMultiattack(name)) return source.attackSlots !== undefined
  return (
    'actionReference' in source ||
    source.attackSlots !== undefined ||
    [source, ...(source.options ?? [])].some((entry) => (entry.effects ?? []).length > 0)
  )
}
