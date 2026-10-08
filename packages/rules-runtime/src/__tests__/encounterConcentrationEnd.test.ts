import { describe, expect, it } from 'vitest'
import { encounterConcentrationEndReason } from '../encounterConcentrationEnd.js'
import {
  SRD_SYSTEM_ID,
  creatureActor,
  srdCondition,
  srdDefinitions
} from '../testing/dnd5eSrdEncounter.js'

const ACTOR_ID = '00000000-0000-4000-8000-0000000c0101'

/** The D95 reason every Concentration end path derives, so planning and persistence agree. */
describe('encounterConcentrationEndReason', () => {
  const reasonFor = (
    actor: ReturnType<typeof creatureActor>,
    conditionIds: readonly string[] = []
  ) =>
    encounterConcentrationEndReason({
      actor,
      conditionIds: [...conditionIds],
      deadCharacterIds: new Set(),
      activeEffects: [],
      gameSystemId: SRD_SYSTEM_ID,
      definitions: srdDefinitions
    })

  it('is DEFEATED for a defeated actor, ahead of any condition', async () => {
    const actor = creatureActor({
      id: ACTOR_ID,
      kind: 'CUSTOM',
      snapshot: {},
      currentHitPoints: 0,
      defeated: true
    })
    expect(await reasonFor(actor, [srdCondition('Paralyzed')])).toBe('DEFEATED')
  })

  it('is INCAPACITATED when a condition suppresses the actor-action capability', async () => {
    const actor = creatureActor({ id: ACTOR_ID, kind: 'CUSTOM', snapshot: {} })
    expect(await reasonFor(actor, [srdCondition('Paralyzed')])).toBe('INCAPACITATED')
  })

  it('is null for an actor that can act, even when grappled and restrained', async () => {
    const actor = creatureActor({ id: ACTOR_ID, kind: 'CUSTOM', snapshot: {} })
    expect(
      await reasonFor(actor, [srdCondition('Grappled'), srdCondition('Restrained')])
    ).toBeNull()
  })
})
