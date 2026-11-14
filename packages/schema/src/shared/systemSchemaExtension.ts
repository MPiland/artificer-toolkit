import type { z } from '../zod.js'
import type { modifierKindSchema } from './enums.js'

// What an installed System adds to the persisted contracts, so that no neutral schema module names a
// System (QUALITY-16.T3, ADR 0042 amendment). Each System declares its extensions under
// `packages/schema/src/systems/<id>/`; `systems/installedSystemSchemas.ts` and
// `systems/installedSystemDefinitionDocuments.ts` list every installed System's, one list per
// capability, and are the only modules that name a System.

/** A System-owned modifier grant kind with no domain parameters and no payload, such as an enable flag. */
export interface SystemModifierGrantKind {
  readonly valueDomainCode: string
  readonly modifierKind: z.infer<typeof modifierKindSchema>
}

/**
 * A System-owned reusable definition family: its stored key, the document kinds it holds and their
 * schema. Only its key is light enough for storage identity (`installedSystemSchemas.ts`).
 */
export interface SystemDefinitionDocumentFamily {
  readonly familyKey: string
  readonly documentKinds: readonly string[]
  readonly documentSchema: z.ZodMiniType
}

/**
 * How a stored rule receipt binds the applications that no execution trace proposes, in the
 * System's own operation and evidence fact keys.
 */
export interface SystemReceiptBindings {
  /** Condition applications of this operation come from a relationship effect's frozen graph (D105). */
  readonly relationshipStateOperationKey: string
  /** Counts a timed effect's turns; its expiry removes the conditions the effect owns (D62.2). */
  readonly durationOperationKey: string
  /** A recurring save: its test, the GM rulings a failure proposes and the evidence facts it records. */
  readonly repeatSave: {
    readonly testOperationKey: string
    readonly testContractVersion: number
    readonly rulingOperationKey: string
    /** False when a gate refused this turn's attempt, so its d20 settled without a request. */
    readonly attemptAllowedFactKey: string
    readonly outcomeRuleFactKey: string
    readonly saveModifierFactKey: string
    readonly contributorChecksumFactKey: string
    /** Absent for a turn-end roll, which names no saving throw ability (D178). */
    readonly saveAbilityDefinitionFactKey: string
  }
}
