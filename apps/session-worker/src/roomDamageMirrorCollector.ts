import {
  heldDamageMirrors,
  pendingDamageMirrors,
  type PendingDamageMirror
} from '@artificer-toolkit/rules-runtime/encounterDamageMirror'
import type { ReceiptApplications } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { RoomTransaction } from './roomEncounterStore.js'

type CollectedMirror = PendingDamageMirror & { occurrenceId: string; rootCommandId: string }

const collected = new WeakMap<
  RoomTransaction,
  { entries: CollectedMirror[]; settledBatches: number }
>()

/** The damage mirrors a command's transaction has collected and the mirror batches it has settled. */
export function damageMirrorLedger(transaction: RoomTransaction) {
  const existing = collected.get(transaction)
  if (existing) return existing
  const created = { entries: [], settledBatches: 0 }
  collected.set(transaction, created)
  return created
}

/**
 * The commit seam's check that every damage-applying path settled its mirrors: a path that collected
 * a holder's mirrored damage and never called `settleDamageMirrors` fails its command here, rather
 * than leaving a Warding Bond's source unharmed.
 */
export function assertDamageMirrorsSettled(transaction: RoomTransaction) {
  if (collected.get(transaction)?.entries.length)
    throw new Error('Collected damage mirrors were never settled.')
}

/**
 * Notes the damage a holder of a mirror took, as its committed receipt shows it, so the command's
 * `settleDamageMirrors` can pass it on to the mirror's source once the root's own settlement is done.
 * Mirrored damage is never collected: it is never mirrored again.
 */
export function collectDamageMirrors(
  transaction: RoomTransaction,
  input: {
    holderActorId: string
    heldEffects: readonly ActiveRuleEffectRecord[]
    occurrenceId: string
    rootCommandId: string
    receiptApplications: ReceiptApplications
  }
) {
  const mirrors = heldDamageMirrors(input.heldEffects)
  if (mirrors.length === 0) return
  damageMirrorLedger(transaction).entries.push(
    ...pendingDamageMirrors({
      holderActorId: input.holderActorId,
      mirrors,
      applications: input.receiptApplications
    }).map((mirror) => ({
      ...mirror,
      occurrenceId: input.occurrenceId,
      rootCommandId: input.rootCommandId
    }))
  )
}
