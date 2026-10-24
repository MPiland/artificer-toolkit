import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'

const VOCABULARY_NOUNS = {
  rollInfluence: 'roll-mode influence',
  rollMode: 'roll mode',
  spellSlotPool: 'spell slot pool',
  effectConsumeEvent: 'effect consume event',
  effectEndEvent: 'effect end event',
  actionTrait: 'action trait',
  size: 'size'
} as const

/** A list a System supplies in place of a fixed wire enum (ADR 0039 decision 5). */
export type SystemCoreCodeKind = keyof typeof VOCABULARY_NOUNS

export interface SystemCoreCodeEntry {
  code: string
  label: string
  description?: string
  /** A spell slot pool that a short rest refills (a pool without it refills on a long rest only). */
  recoversOnShortRest?: boolean
  /** A lifecycle event that a timed grant may carry (an effect event not marked grantable is for effects only). */
  grantable?: boolean
  /** The fact an Encounter raises with an action that the trait describes. */
  actionFact?: 'attackRoll' | 'spellCast'
  /** The edge in feet of the square a creature of this size fills; a size without it fills none a Scene models. */
  spaceFeet?: number
}

/**
 * A System's vocabulary lists: each code unique within its list, labels for display only. The size
 * list runs smallest first, so a size's index is its step.
 */
export interface SystemCoreCodeAdapter {
  gameSystemId: string
  lists: Readonly<Record<SystemCoreCodeKind, readonly SystemCoreCodeEntry[]>>
}

/**
 * The one seam that decides whether a wire code belongs to a System's vocabulary. Every ingress that
 * knows its `gameSystemId` (authoring, import, compile, command input, settlement) calls
 * `requireCode`; the schema only checks a code's shape.
 */
export function createSystemCoreCodeRegistry(adapters: readonly SystemCoreCodeAdapter[]) {
  for (const adapter of adapters)
    for (const [kind, entries] of Object.entries(adapter.lists))
      if (new Set(entries.map(({ code }) => code)).size !== entries.length)
        throw new Error(`Duplicate ${VOCABULARY_NOUNS[kind as SystemCoreCodeKind]} code.`)
  const registry = createSystemCapabilityRegistry('vocabulary', adapters)
  return {
    entries(gameSystemId: string, kind: SystemCoreCodeKind): readonly SystemCoreCodeEntry[] {
      return registry.require(gameSystemId).lists[kind]
    },
    requireCode(gameSystemId: string, kind: SystemCoreCodeKind, code: string) {
      const entry = registry.require(gameSystemId).lists[kind].find((item) => item.code === code)
      if (!entry)
        throw new Error(`The Game System does not define the ${VOCABULARY_NOUNS[kind]} "${code}".`)
      return entry
    }
  }
}

export type SystemCoreCodeRegistry = ReturnType<typeof createSystemCoreCodeRegistry>
