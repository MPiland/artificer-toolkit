import { describe, expect, it } from 'vitest'
import { setupCreatureReactionRun, reactionInput } from '../../tests/fixtures/movementReaction'
import { discoverNativeMovementReactions } from './movementReactionDiscovery'

describe('automatic native movement reaction policy', () => {
  it('discovers an eligible automatic action with a nullable choice definition', async () => {
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
    if (!entry || entry.kind !== 'AUTOMATIC_ACTION') throw new Error('Missing automatic action.')
    expect(entry.option.policy).toMatchObject({
      eligible: true,
      selectionPolicy: 'AUTOMATIC',
      choiceDefinitionId: null
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
