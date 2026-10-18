import { beforeAll, describe, expect, it } from 'vitest'
import { meleeRetaliationEvidenceDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEffectEvidence'

import {
  meleeRetaliationCharacterTransition,
  planEncounterMeleeRetaliation,
  selectMeleeRetaliationContacts
} from '../encounterMeleeRetaliation.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import {
  createSrdRulesRuntime,
  srdCreatureTarget,
  srdEncounterState,
  testUuid,
  TIMESTAMP
} from '../testing/dnd5eSrdEncounter.js'
import { placedFireShield } from '../testing/fireShieldZoneFixture.js'
import {
  actors,
  GM_USER_ID,
  goblin,
  GOBLIN_ID,
  GOBLIN_TOKEN_ID,
  OCCURRENCE_ID,
  SCENE_ID,
  SOURCE_ID,
  SOURCE_TOKEN_ID
} from '../testing/encounterTurnZoneFixture.js'

/**
 * SPELLS-20 T6d2a (D153): a zone its holder carries on its token answers a melee hit by burning the
 * attacker standing in it, with dice the system rolls.
 */

let runtime: RulesRuntimeService
beforeAll(() => {
  runtime = createSrdRulesRuntime()
})

const CASTER_AT = { x: 1000, y: 350 }
/** The caster's and the goblin attacker's tokens as the attack's Scene context pins them. */
const hit = {
  actorId: SOURCE_ID,
  tokenId: SOURCE_TOKEN_ID,
  position: CASTER_AT,
  width: 100,
  height: 100
}
const attackerAt = (x: number) => ({
  actorId: GOBLIN_ID,
  tokenId: GOBLIN_TOKEN_ID,
  position: { x, y: CASTER_AT.y },
  width: 100,
  height: 100
})
const shield = (seed: number, kind: 'WARM' | 'CHILL' = 'WARM') =>
  placedFireShield({
    seed,
    sourceActorId: SOURCE_ID,
    sourceTokenId: SOURCE_TOKEN_ID,
    sceneId: SCENE_ID,
    shield: kind
  })
/** The zones a hit on the caster sets off, the attacker beside it unless `x` puts it elsewhere. */
const select = (effects: ReturnType<typeof shield>[], x = CASTER_AT.x + 100) =>
  selectMeleeRetaliationContacts({ actors, attacker: attackerAt(x), hit, effects })
const state = srdEncounterState({ actors, currentActorId: GOBLIN_ID })
function plan(
  selected: NonNullable<ReturnType<typeof select>>,
  replay: Pick<Parameters<typeof planEncounterMeleeRetaliation>[0], 'random' | 'retained'> = {
    // The lowest face: each d8 rolls 1.
    random: () => 0
  }
) {
  return planEncounterMeleeRetaliation({
    selected,
    attacker: srdCreatureTarget(goblin),
    encounter: state,
    occurrenceId: OCCURRENCE_ID,
    sourceCommandId: testUuid(0x3b0),
    occurredAt: TIMESTAMP,
    userId: GM_USER_ID,
    runtime,
    ...replay
  })
}
const noFreshDice = () => {
  throw new Error('A replay must roll no fresh die.')
}

describe('a melee hit setting off the zones its target holds (SPELLS-20 T6d2a, D153)', () => {
  it('selects the shield of the creature hit when its attacker stands in it', () => {
    const zone = shield(0x3c0)
    const selected = select([zone])
    expect(selected?.contacts).toEqual([
      { effectId: zone.id, sourceActorId: SOURCE_ID, targetActorId: GOBLIN_ID }
    ])
    expect(selected?.selectionChecksum).toBe(select([zone])?.selectionChecksum)
  })

  it('selects nothing for an attacker beyond the shield', () => {
    const zone = shield(0x3c0)
    expect(select([zone], CASTER_AT.x + 300)).toBeNull()
  })

  it('pins the zone’s version and both tokens, so an edited zone or a moved token changes it', () => {
    const zone = shield(0x3c0)
    const pinned = select([zone])?.selectionChecksum
    expect(select([{ ...zone, version: zone.version + 1 }])?.selectionChecksum).not.toBe(pinned)
    expect(select([zone], CASTER_AT.x + 90)?.selectionChecksum).not.toBe(pinned)
  })

  it('burns the attacker with 2d8 the system rolls and plans its one mechanics batch', async () => {
    const selected = select([shield(0x3c0)])!
    const { evidence, settlement, projectedAttacker } = await plan(selected)
    expect(meleeRetaliationEvidenceDtoSchema.parse(evidence)).toEqual(evidence)
    const [execution] = evidence.executions
    expect(evidence.selectionChecksum).toBe(selected.selectionChecksum)
    expect(execution!.targetTransition.after.currentHitPoints).toBe(
      execution!.targetTransition.before.currentHitPoints - 2
    )
    expect(settlement?.batch).toMatchObject({
      targetActorId: GOBLIN_ID,
      expectedEncounterVersion: state.version,
      expectedCharacterStreamVersion: null
    })
    expect(settlement?.plan.targetTransition.after).toEqual(execution!.targetTransition.after)
    expect(projectedAttacker.state.current).toBe(execution!.targetTransition.after.currentHitPoints)
  })

  it('applies two shields in effect-id order, each from the state the last left', async () => {
    const later = shield(0x3c9, 'CHILL')
    const earlier = shield(0x3c3)
    const { evidence, settlement } = await plan(select([later, earlier])!)
    expect(evidence.executions.map(({ candidate }) => candidate.candidate.effectId)).toEqual([
      earlier.id,
      later.id
    ])
    const [first, second] = evidence.executions
    expect(second!.targetTransition.before).toEqual(first!.targetTransition.after)
    expect(settlement?.plan.targetTransition.after.currentHitPoints).toBe(
      first!.targetTransition.before.currentHitPoints - 4
    )
  })

  it('leaves a Creature attacker’s burn without a Character span', async () => {
    const { evidence } = await plan(select([shield(0x3c0)])!)
    expect(meleeRetaliationCharacterTransition(evidence)).toBeNull()
  })
})

describe('a retained melee retaliation replayed by a later run (SPELLS-20 T6d2b, D153)', () => {
  it('rebuilds the same evidence from its recorded dice', async () => {
    const selected = select([shield(0x3c0), shield(0x3c9, 'CHILL')])!
    const planned = await plan(selected, { random: (maximum) => maximum - 1 })
    const replayed = await plan(selected, { random: noFreshDice, retained: planned.evidence })
    expect(replayed.evidence).toEqual(planned.evidence)
    expect(replayed.settlement?.plan.targetTransition.after).toEqual(
      planned.settlement?.plan.targetTransition.after
    )
  })

  it('refuses evidence that no longer matches the zones the hit selects', async () => {
    const zone = shield(0x3c0)
    const { evidence } = await plan(select([zone])!)
    await expect(
      plan(select([{ ...zone, version: zone.version + 1 }])!, {
        random: noFreshDice,
        retained: evidence
      })
    ).rejects.toThrow('Retained melee retaliation evidence is stale.')
  })

  it('refuses evidence that recorded fewer dice than the replay rolls', async () => {
    const selected = select([shield(0x3c0), shield(0x3c9, 'CHILL')])!
    const { evidence } = await plan(selected)
    await expect(
      plan(selected, {
        random: noFreshDice,
        retained: { ...evidence, executions: evidence.executions.slice(0, 1) }
      })
    ).rejects.toThrow('Retained melee retaliation evidence is missing a recorded die.')
  })
})
