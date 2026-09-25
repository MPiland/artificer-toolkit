import { describe, expect, it } from 'vitest'
import { setupCreatureReactionRun, reactionInput } from '../../tests/fixtures/movementReaction'
import { ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/encounterMovementReactionDecision'
import { discoverNativeMovementReactions } from './movementReactionDiscovery'

describe('automatic native movement reaction policy', () => {
  it('offers an authored automatic reaction to its controller as a Use/Decline choice in Assisted mode', async () => {
    const base = await setupCreatureReactionRun(null, true, false, 'AUTOMATIC')
    const input = reactionInput({
      encounterId: base.run.id,
      expectedEncounterVersion: base.run.version,
      movingActorId: base.mover.id,
      reactorActorId: base.reactor.id,
      occurrenceId: crypto.randomUUID()
    })

    const discovered = await base.owner.caller.run((ctx) =>
      discoverNativeMovementReactions(ctx, input)
    )
    const entry = discovered.reactionTimeline[0]
    if (!entry || entry.kind !== 'CONTROLLER_CHOICE') throw new Error('Missing controller choice.')
    expect(entry.group.options[0]?.candidate.reactorActorId).toBe(base.reactor.id)
    expect(entry.group.options[0]?.policy).toMatchObject({
      eligible: true,
      selectionPolicy: 'CHOICE',
      choiceDefinitionId: ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID
    })
  }, 30000)

  it('keeps the default fixture as a controller choice', async () => {
    const base = await setupCreatureReactionRun()
    const input = reactionInput({
      encounterId: base.run.id,
      expectedEncounterVersion: base.run.version,
      movingActorId: base.mover.id,
      reactorActorId: base.reactor.id,
      occurrenceId: crypto.randomUUID()
    })

    const discovered = await base.owner.caller.run((ctx) =>
      discoverNativeMovementReactions(ctx, input)
    )
    expect(discovered.reactionTimeline[0]?.kind).toBe('CONTROLLER_CHOICE')
  }, 30000)
})
