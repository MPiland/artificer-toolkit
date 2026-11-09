import type { EncounterCharacterEffectsTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { MutationCtx } from '../_generated/server'
import { writeCharacterRecord } from '../characters/characterWrites'
import { storeCharacterSheetSections } from '../characters/sheetSectionDerivation'
import type { CharacterSheetSourceContext } from '../characters/sheetFacts'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { encounterReadPorts } from './encounterReadPorts'

const effectsTransactions = new WeakMap<
  MutationCtx,
  EncounterCharacterEffectsTransaction<CharacterSheetSourceContext>
>()

/**
 * A Convex mutation transaction as the Encounter code ends a Character's effects; one per Convex
 * context, sharing its store with `encounterWriteTransaction`. Callers outside Encounter commands
 * use it so their modules leave the command ports out (PERF-6.T6).
 */
export function encounterCharacterEffectsTransaction(
  ctx: MutationCtx
): EncounterCharacterEffectsTransaction<CharacterSheetSourceContext> {
  const known = effectsTransactions.get(ctx)
  if (known) return known
  const { readCharacterRow, readCharacterRecord, readCurrentDefinition } = encounterReadPorts(ctx)
  const transaction: EncounterCharacterEffectsTransaction<CharacterSheetSourceContext> = {
    db: createConvexEncounterStore(ctx),
    ports: {
      readCharacterRow,
      readCharacterRecord,
      readCurrentDefinition,
      writeCharacterRecord: async (input) => {
        await writeCharacterRecord(ctx, {
          ...input,
          storeSheetSections: storeCharacterSheetSections
        })
      }
    }
  }
  effectsTransactions.set(ctx, transaction)
  return transaction
}
