import { describe, expect, it } from 'vitest'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import {
  execute,
  setup,
  start,
  type CommandResult,
  type Fixture
} from '../../tests/fixtures/liveCharacterRun'
import {
  closeRoom,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { expectReusedCommandRefusal, rejection } from '../../tests/fixtures/roomRefusals'
import { internal } from '../_generated/api'

useLocalRoomWorker()

/** An ACTIVE Run with the Morale rule on, its enemy Creature unharmed. */
async function moraleRun() {
  const fixture = await setup()
  const morale = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    (definition) => definition.document.kind === 'MORALE'
  )
  if (!morale) throw new Error('Missing published Morale.')
  await fixture.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [morale]
  })
  await seedRoomContentSnapshots(fixture.campaign.id)
  const replaced = await execute(fixture, (base) => ({
    ...base,
    type: 'REPLACE_OPTIONAL_COMBAT_RULES',
    expectedVersion: fixture.run.version,
    definitionIds: [morale.id]
  }))
  const started = await start({
    ...fixture,
    run: { ...fixture.run, version: replaced.projection.version }
  })
  return { fixture, started }
}

function moraleSave(fixture: Fixture, from: CommandResult, commandId?: string) {
  return execute(fixture, (base) => ({
    ...base,
    commandId: commandId ?? base.commandId,
    type: 'MORALE_SAVE',
    expectedVersion: from.projection.version,
    actorId: fixture.enemy.id,
    triggerKind: 'INDIVIDUAL_SURPRISED',
    leaderActorId: null,
    overwhelmingOpposition: false,
    escapePossible: true,
    roll: { kind: 'AUTO_ROLL' },
    visibility: 'PUBLIC'
  }))
}

describe('Morale commands through the room (ENCOUNTER-6.1)', () => {
  it('replays a check by its command ID without a second roll, and refuses that ID for other input', async () => {
    const { fixture, started } = await moraleRun()
    const commandId = crypto.randomUUID()
    const checked = await moraleSave(fixture, started, commandId)
    await expect(moraleSave(fixture, started, commandId)).resolves.toEqual(checked)
    // The replay advanced nothing, so the confirmation still follows the first commit's version.
    const confirmed = await execute(fixture, (base) => ({
      ...base,
      type: 'CONFIRM_MORALE',
      expectedVersion: checked.projection.version,
      actorId: fixture.enemy.id,
      disposition: 'FLEE'
    }))
    expect(confirmed.projection.version).toBe(checked.projection.version + 1)
    // After a room restart Convex's own record answers the same ID.
    await closeRoom(fixture.campaign.id)
    const afterRestart = await moraleSave(fixture, started, commandId)
    expect(afterRestart.projection.version).toBe(checked.projection.version)
    await expectReusedCommandRefusal(
      execute(fixture, (base) => ({
        ...base,
        commandId,
        type: 'MORALE_SAVE',
        expectedVersion: started.projection.version,
        actorId: fixture.enemy.id,
        triggerKind: 'INDIVIDUAL_CANNOT_HARM_OPPOSITION',
        leaderActorId: null,
        overwhelmingOpposition: false,
        escapePossible: true,
        roll: { kind: 'AUTO_ROLL' },
        visibility: 'PUBLIC'
      }))
    )
  }, 120000)

  it('refuses a check that reuses the ID of a Convex command (COMMAND_ID_REUSED)', async () => {
    const { fixture, started } = await moraleRun()
    expect(await rejection(moraleSave(fixture, started, fixture.createCommandId))).toMatchObject({
      reason: 'COMMAND_ID_REUSED'
    })
    // Nothing was recorded, so the same check still runs under a fresh ID.
    expect((await moraleSave(fixture, started)).projection.version).toBe(
      started.projection.version + 1
    )
  }, 120000)
})
