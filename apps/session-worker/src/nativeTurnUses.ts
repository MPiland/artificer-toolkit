import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterActionSourceInput } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  actorGrantedActions,
  nextGrantedAttackCharge,
  parseGrantedActionId
} from '@artificer-toolkit/rules-runtime/encounterGrantedActions'
import { parseRepeatPathActionId } from '@artificer-toolkit/rules-runtime/encounterRepeatPathAction'

/** The feet an actor has moved this turn, read from the room's store. */
export async function readNativeLiveTurnMovedFeet(
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => Promise<LiveSessionEncounterRulesResponse>,
  actorId: string
): Promise<number> {
  const captured = await capture({ kind: 'TURN_MOVED_FEET', actorId })
  if (captured.kind !== 'TURN_MOVED_FEET') throw new Error('Turn movement is unavailable.')
  return captured.feet
}

/** An actor's latest voluntary move this turn (D164), read from the room's store. */
export async function readNativeLiveTurnLastMove(
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => Promise<LiveSessionEncounterRulesResponse>,
  actorId: string
) {
  const captured = await capture({ kind: 'TURN_LAST_MOVE', actorId })
  if (captured.kind !== 'TURN_LAST_MOVE') throw new Error('Turn movement is unavailable.')
  return captured.lastMove
}

/** Whether the actor's turn in `round` was already begun, and so ran its start-of-turn effects. */
export async function readNativeLiveTurnStarted(
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => Promise<LiveSessionEncounterRulesResponse>,
  turn: { round: number; actorId: string }
): Promise<boolean> {
  const captured = await capture({ kind: 'TURN_STARTED', ...turn })
  if (captured.kind !== 'TURN_STARTED') throw new Error('Turn start is unavailable.')
  return captured.startedByCommandId !== null
}

/** The once-per-turn uses an actor has spent this turn (D119), read from the room's store. */
export async function readNativeLiveTurnUses(
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => Promise<LiveSessionEncounterRulesResponse>,
  actorId: string
): Promise<readonly string[]> {
  const captured = await capture({ kind: 'TURN_USES', actorId })
  if (captured.kind !== 'TURN_USES') throw new Error('Turn uses are unavailable.')
  return captured.keys
}

/**
 * What an action source reads of the offers held effects make, as they stand now: a granted action's
 * holder effects, spent uses and Character rules (D160, D188), or a repeat's every-holder effects,
 * turn and spent uses (D166, D190a). Any other action reads neither.
 */
export async function readNativeActionSourceOffers(input: {
  capture: Parameters<typeof readNativeLiveTurnUses>[0]
  actorId: string
  actionId: string
  state: EncounterRunState
  activeEffectsByActorId: NonNullable<EncounterActionSourceInput['repeat']>['effectsByHolder']
  characterRules: NonNullable<EncounterActionSourceInput['granted']>['characterRules']
}): Promise<Pick<EncounterActionSourceInput, 'granted' | 'repeat'>> {
  const granted = parseGrantedActionId(input.actionId)
  if (!granted && !parseRepeatPathActionId(input.actorId, input.actionId)) return {}
  const spentKeys = await readNativeLiveTurnUses(input.capture, input.actorId)
  return granted
    ? {
        granted: {
          heldEffects: input.activeEffectsByActorId.get(input.actorId) ?? [],
          spentKeys,
          characterRules: input.characterRules
        }
      }
    : { repeat: { effectsByHolder: input.activeEffectsByActorId, turn: input.state, spentKeys } }
}

/**
 * What the actor's next weapon attack charges through its weapon-attack offers (Flurry of Blows),
 * as they stand now; null when no offer covers it.
 */
export async function readNativeWeaponAttackOffer(input: {
  capture: Parameters<typeof readNativeLiveTurnUses>[0]
  actor: Parameters<typeof actorGrantedActions>[1]
  heldEffects: Parameters<typeof actorGrantedActions>[0]
  characterRules: Parameters<typeof actorGrantedActions>[2]
}) {
  const holds = actorGrantedActions(input.heldEffects, input.actor, input.characterRules).filter(
    ({ offer }) => offer.weaponAttack
  )
  const spent = holds.length > 0 ? await readNativeLiveTurnUses(input.capture, input.actor.id) : []
  return nextGrantedAttackCharge(holds, spent)
}

/**
 * Whether an actor has yet to take a turn in the Encounter: it is READY in the first round's
 * initiative, read from the room's store. Later rounds mean every actor has had a turn.
 */
export async function readNativeLiveHasNotTakenTurn(
  capture: (
    request: LiveSessionEncounterRulesRequest
  ) => Promise<LiveSessionEncounterRulesResponse>,
  actorId: string
): Promise<boolean> {
  const captured = await capture({ kind: 'INITIATIVE_ROUND' })
  if (captured.kind !== 'INITIATIVE_ROUND') throw new Error('Turn initiative is unavailable.')
  const { state } = captured
  return (
    state !== null &&
    state.round.round === 1 &&
    state.participants.some(
      (participant) => participant.actorId === actorId && participant.status === 'READY'
    )
  )
}
