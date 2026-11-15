import type * as EncounterEventHooks from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import type { EncounterEvent } from '@artificer-toolkit/rules-runtime/events/encounterEventTable'

/**
 * Records each DAMAGED(AFTER) event that meets a holder's held effects (QUALITY-14.T2e2e): the raise
 * whose hooks end, grant and owe repeat saves. A room test installs it with `vi.mock` on
 * `@artificer-toolkit/rules-runtime/events/encounterEventHooks`, which wraps the real discovery and
 * changes nothing it returns, and resets the module graph before its rooms start, since the pool
 * loads the room's modules before any test file's mock registers.
 *
 * The room plans a command's raises (`room`); its commit re-derives a raise from the committed rows
 * to check the plan (`commit`: any raise reached through `encounter-persistence`).
 *
 * The records live on the isolate's global, since the reset graph loads its own copy of this module.
 */
type DamagedRaises = { room: string[]; commit: string[] }
const recorded = globalThis as typeof globalThis & { damagedRaises?: DamagedRaises }
const raises = (recorded.damagedRaises ??= { room: [], commit: [] })

export async function recordingDamagedRaises(
  importOriginal: () => Promise<typeof EncounterEventHooks>
): Promise<typeof EncounterEventHooks> {
  const original = await importOriginal()
  return {
    ...original,
    discoverEncounterEventHooks: (input) => {
      const events: readonly EncounterEvent[] = input.events
      if (input.effects !== undefined)
        for (const event of events)
          if (event.kind === 'DAMAGED' && event.phase === 'AFTER')
            raises[
              /encounter-persistence[\\/]/.test(new Error().stack ?? '') ? 'commit' : 'room'
            ].push(event.holderActorId)
      return original.discoverEncounterEventHooks(input)
    }
  }
}

/** The holders of the DAMAGED(AFTER) raises recorded since the last call, in raise order. */
export function takeDamagedRaises(): DamagedRaises {
  return { room: raises.room.splice(0), commit: raises.commit.splice(0) }
}
