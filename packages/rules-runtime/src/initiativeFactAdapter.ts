import type { RuleValue } from '@artificer-toolkit/shared/rules'
import type { InitiativeDeclarationFactsDto } from '@artificer-toolkit/schema/shared/initiativeState'

import type { InitiativeActorFactSource } from '@artificer-toolkit/schema/shared/initiativeFactSources'

export type InitiativeFactBinding =
  | {
      automatic: true
      facts: Readonly<Record<string, RuleValue>>
    }
  | {
      automatic: false
    }

/**
 * A locked Initiative side has identity and exact participant sources only.
 * Labels, presentation state, and side relationships are not graph facts.
 */
export type LockedEncounterInitiativeSideFactSource = {
  sideId: string
  participants: readonly InitiativeActorFactSource[]
}

/** System-owned translation from locked aggregate facts to graph facts. */
export interface InitiativeFactAdapter {
  gameSystemId: string
  bindActor(source: InitiativeActorFactSource): InitiativeFactBinding
  /** Binds already-persisted declaration facts; the application never derives System arithmetic. */
  bindDeclaredActor(
    source: InitiativeActorFactSource,
    declaration: InitiativeDeclarationFactsDto
  ): InitiativeFactBinding
  bindSide(source: LockedEncounterInitiativeSideFactSource): InitiativeFactBinding
  /** The roll mode a two-die declared initiative settled under, read from its graph facts; null when they record none. */
  declaredRollMode(facts: Readonly<Record<string, unknown>>): string | null
}
