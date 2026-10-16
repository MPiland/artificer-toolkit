import { describe, expect, it } from 'vitest'
import {
  type EncounterCommandResultDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_CONCENTRATION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/concentration.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { barbarianState, rages, setupBarbarianRun, srdBarbarian } from '../../tests/fixtures/barbarianRun'
import type { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { queueRoomRolls, useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'
import { importedSubject } from '../../tests/fixtures/publication'
import {
  importSeededSrdCreatureSenses,
  seededSrdCreature,
  seededSrdLoadoutEquipment
} from '../../tests/fixtures/srdCreatures'
import { executeOnRun } from '../../tests/fixtures/srdWolfRun'
import { internal } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'

useLocalRoomWorker()

const dragon = seededSrdCreature('Adult Red Dragon')

/** The seeded SRD Adult Red Dragon with the Legendary Action, Resistance, Recharge and Concentration policies it needs. */
const dragonEnemy = {
  creature: dragon,
  async prepare(base: Awaited<ReturnType<typeof setupCharacterRun>>) {
    const alreadyImported = new Set([
      SRD_ACTION_ALLOWANCE_DEFINITION_ID,
      SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
      SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
    ])
    for (const definitions of sourceImportBatches([
      ...SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS.map((definition) => ({
        ...definition,
        document: jsonValueSchema.parse(definition.document)
      })),
      ...SRD_RULE_STATE_DEFINITIONS.filter(({ id }) => !alreadyImported.has(id)),
      ...SRD_CONCENTRATION_DEFINITIONS
    ]))
      await base.t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions
      })
    await importSeededSrdCreatureSenses(base.t, dragon)
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({ ...dragon, subjectKind: 'CREATURE', document: dragon }),
        ...seededSrdLoadoutEquipment(dragon).map(importedSubject)
      ]
    })
  }
}

type Settled = EncounterCommandResultDto

type RunFixture = Parameters<typeof executeOnRun>[0]

const advance = (fixture: RunFixture, from: Settled) =>
  executeOnRun(fixture, (base) => ({
    ...base,
    type: 'ADVANCE_TURN',
    expectedVersion: from.projection.version
  }))

const respond = (
  fixture: RunFixture,
  from: Settled,
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) =>
  executeOnRun(fixture, (base) => {
    if (!from.occurrence) throw new Error('Expected a pending turn occurrence.')
    return {
      ...base,
      type: 'RESOLVE_RULE_OCCURRENCE',
      expectedVersion: from.projection.version,
      occurrenceId: from.occurrence.occurrenceId,
      expectedOccurrenceVersion: from.occurrence.occurrenceVersion,
      correlationId: null,
      resolution
    }
  })

/** Answers whatever a turn change asks until it commits: the dragon declines its window, a Recharge rolls 5. */
async function settleTurn(
  fixture: RunFixture,
  started: Settled
): Promise<Settled> {
  let result = started
  for (let step = 0; step < 6 && result.occurrence?.status !== 'COMPLETE'; step += 1) {
    const pending = result.occurrence?.pending
    if (!pending) break
    if (pending.kind === 'LEGENDARY_ACTION_CHOICE')
      result = await respond(fixture, result, { kind: 'DECLINE' })
    else if (pending.kind === 'RECHARGE_EVIDENCE')
      result = await respond(fixture, result, {
        kind: 'ENTER_INTEGER',
        requestId: pending.request.requestId,
        value: 5
      })
    else throw new Error(`Unexpected turn prompt ${pending.kind}.`)
  }
  return result
}

describe('a Rage and a Legendary Action at the end of the Barbarian turn (ATTACK-9.T6)', () => {
  it('counts the damage a Legendary Action deals at the end of an idle turn', async () => {
    const fixture = await setupBarbarianRun(srdBarbarian, 'ASSISTED', dragonEnemy)
    // The Rage starts on the Barbarian's first turn, which skips its check. Its second turn is idle.
    const raged = await rages(fixture)
    const firstEnd = await settleTurn(fixture, await advance(fixture, raged))
    expect(firstEnd.projection.currentActorId).toBe(fixture.wolf.id)
    const secondTurn = await settleTurn(fixture, await advance(fixture, firstEnd))
    expect(secondTurn.projection.currentActorId).toBe(fixture.actor.id)
    const before = await barbarianState(fixture)
    expect(before.grantIds).toHaveLength(1)

    // The dragon's window opens at the end of that turn and its Tail hits (a natural 19; 2d8 + 8 rolls 1 and 1).
    const window = await advance(fixture, secondTurn)
    const pending = window.occurrence?.pending
    if (pending?.kind !== 'LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected the dragon’s Legendary Action choice.')
    const tail = pending.options.find((option) => option.label === 'Tail Attack')
    if (!tail) throw new Error('Expected the Tail Attack option.')
    await queueRoomRolls(fixture.campaign.id, { rolls: [18, 0, 0] })
    await respond(fixture, window, {
      kind: 'LEGENDARY_OPTION',
      optionId: tail.optionId,
      targetActorId: fixture.actor.id
    })

    const after = await barbarianState(fixture)
    expect(after.hitPoints).toBeLessThan(before.hitPoints)
    expect(after.grantIds).toEqual(before.grantIds)
  }, 300000)
})
