import {
  MAX_CONSEQUENCE_ROLL_OFFERS,
  type ConsequenceRollTriggerDto,
  type EncounterConsequenceRollOfferDto
} from '@artificer-toolkit/schema/shared/consequenceRolls'
import { deathSaveShortfall } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'

import type { DamageBatch } from './encounterConcentrationDamage.js'
import type { ConsequenceRollTable } from './optionalCombatPolicyCapability.js'
import { optionalCombatPolicyCapabilityRegistry } from './platformEncounterPolicy.js'

/** What one command did to one actor, as consequence triggers read it (ATTACK-15). */
export type ConsequenceRollFacts = {
  readonly damaged: boolean
  readonly critical: boolean
  readonly droppedToZero: boolean
  /** How far the actor's death save fell short of its DC; null when it made none or succeeded. */
  readonly deathSaveShortfall: number | null
}

type ActorChange = { before: EncounterRunActorState; after: EncounterRunActorState }

const NO_FACTS: ConsequenceRollFacts = {
  damaged: false,
  critical: false,
  droppedToZero: false,
  deathSaveShortfall: null
}

/** The consequence facts of a command's damage rows, by target actor; a row that applied none is skipped. */
export function consequenceRollDamageFacts(
  batches: readonly DamageBatch[]
): Map<string, ConsequenceRollFacts> {
  const facts = new Map<string, ConsequenceRollFacts>()
  for (const batch of batches)
    for (const row of batch.applications) {
      if (row.kind !== 'DAMAGE' || row.appliedAmount === 0) continue
      const current = facts.get(batch.targetActorId) ?? NO_FACTS
      facts.set(batch.targetActorId, {
        ...current,
        damaged: true,
        critical: current.critical || row.critical,
        droppedToZero:
          current.droppedToZero ||
          (row.beforeCurrentHitPoints > 0 && row.afterCurrentHitPoints === 0)
      })
    }
  return facts
}

/** Adds an actor's death save roll to a command's facts. */
export function withDeathSaveFacts(
  facts: ReadonlyMap<string, ConsequenceRollFacts>,
  save: { actorId: string; rawDie: number; addedTotal: number }
): Map<string, ConsequenceRollFacts> {
  return new Map(facts).set(save.actorId, {
    ...(facts.get(save.actorId) ?? NO_FACTS),
    deathSaveShortfall: deathSaveShortfall(save.rawDie, save.addedTotal)
  })
}

function triggerMet(trigger: ConsequenceRollTriggerDto, facts: ConsequenceRollFacts): boolean {
  switch (trigger.event) {
    case 'DAMAGED':
      return facts.damaged && (!trigger.critical || facts.critical)
    case 'HIT_POINTS_ZERO':
      return facts.droppedToZero
    case 'DEATH_SAVE_FAILED':
      return facts.deathSaveShortfall !== null && facts.deathSaveShortfall >= trigger.byAtLeast
  }
}

function withOffers(
  actor: EncounterRunActorState,
  offers: readonly EncounterConsequenceRollOfferDto[],
  updatedAt: string
): EncounterRunActorState {
  const { consequenceRollOffers: _previous, ...rest } = actor
  return encounterRunActorStateSchema.parse({
    ...rest,
    ...(offers.length > 0 && { consequenceRollOffers: offers }),
    updatedAt
  })
}

const sameOffer =
  (offer: Pick<EncounterConsequenceRollOfferDto, 'sourceCommandId' | 'definitionId'>) =>
  (candidate: EncounterConsequenceRollOfferDto) =>
    candidate.sourceCommandId === offer.sourceCommandId &&
    candidate.definitionId === offer.definitionId

/** The consequence tables the Run's optional rules enable. */
export function encounterConsequenceRollTables(
  state: Pick<
    EncounterRunState,
    'automationMode' | 'gameSystemId' | 'optionalCombatSnapshot' | 'optionalCombatSnapshotChecksum'
  >
): readonly ConsequenceRollTable[] {
  return (
    optionalCombatPolicyCapabilityRegistry.find(state.gameSystemId)?.consequenceRollTables({
      automationMode: state.automationMode,
      gameSystemId: state.gameSystemId,
      optionalCombatSnapshot: state.optionalCombatSnapshot ?? null,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
    }) ?? []
  )
}

/**
 * The offers one command's facts make: per table and Character actor, one offer listing every
 * trigger met, merged into an earlier offer of the same command. Creatures get none; their injuries
 * are the GM's ruling (D187a). The newest offers are kept when an actor holds too many.
 */
export function offerConsequenceRolls(input: {
  state: Parameters<typeof encounterConsequenceRollTables>[0]
  actors: readonly EncounterRunActorState[]
  facts: ReadonlyMap<string, ConsequenceRollFacts>
  sourceCommandId: string
  occurredAt: string
}): ActorChange[] {
  const tables = input.facts.size > 0 ? encounterConsequenceRollTables(input.state) : []
  return input.actors.flatMap((actor) => {
    const facts = input.facts.get(actor.id)
    if (actor.kind !== 'CHARACTER' || !facts) return []
    let offers = actor.consequenceRollOffers ?? []
    let changed = false
    for (const table of tables) {
      const identity = {
        sourceCommandId: input.sourceCommandId,
        definitionId: table.pin.definitionId
      }
      const earlier = offers.find(sameOffer(identity))
      const triggers = table.triggers.filter(
        (trigger) =>
          triggerMet(trigger, facts) || earlier?.triggers.some((met) => met.event === trigger.event)
      )
      if (triggers.length === 0) continue
      changed = true
      offers = [
        ...offers.filter((offer) => !sameOffer(identity)(offer)),
        {
          ...identity,
          label: table.label,
          triggers,
          occurredAt: earlier?.occurredAt ?? input.occurredAt
        }
      ].slice(-MAX_CONSEQUENCE_ROLL_OFFERS)
    }
    return changed ? [{ before: actor, after: withOffers(actor, offers, input.occurredAt) }] : []
  })
}

/**
 * Withdraws every offer a command made, as undoing that command does; actors that held none come
 * back unchanged, so a caller can skip writing them.
 */
export function withdrawConsequenceRollOffers(
  actors: readonly EncounterRunActorState[],
  sourceCommandId: string,
  updatedAt: string
): EncounterRunActorState[] {
  return actors.map((actor) => {
    const offers = actor.consequenceRollOffers ?? []
    const kept = offers.filter((offer) => offer.sourceCommandId !== sourceCommandId)
    return kept.length === offers.length ? actor : withOffers(actor, kept, updatedAt)
  })
}

/** Removes one resolved offer. */
export function withoutConsequenceRollOffer(
  actor: EncounterRunActorState,
  offer: EncounterConsequenceRollOfferDto,
  updatedAt: string
): EncounterRunActorState {
  return withOffers(
    actor,
    (actor.consequenceRollOffers ?? []).filter((candidate) => !sameOffer(offer)(candidate)),
    updatedAt
  )
}

/** The row a roll lands on; null when it falls in a gap between the authored rows. */
export function consequenceRollRow(
  table: ConsequenceRollTable,
  roll: number
): ConsequenceRollTable['rows'][number] | null {
  return table.rows.find((row) => row.minimum <= roll && roll <= row.maximum) ?? null
}
