import assert from 'node:assert/strict'
import type { EncounterExecuteInput } from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import { type DevelopmentClient, executeEncounterCommand } from './developmentClient'

// The same assertions run against the local transactional adapter and authenticated HTTP clients.
export async function verifyEncounterCharacterCommands({
  owner,
  player,
  anonymous,
  campaignId,
  characterId,
  checkpoint
}: {
  owner: DevelopmentClient
  player: DevelopmentClient
  anonymous: DevelopmentClient
  campaignId: string
  characterId: string
  /** Publishes a room-held Run to Convex before the proof reads it there. */
  checkpoint?: () => Promise<void>
}) {
  const measurements: Array<{ operation: string; elapsedMs: number; responseBytes: number }> = []
  async function measure<T>(operation: string, run: () => Promise<T>): Promise<T> {
    const started = performance.now()
    const result = await run()
    measurements.push({
      operation,
      elapsedMs: Math.round((performance.now() - started) * 100) / 100,
      responseBytes: Buffer.byteLength(JSON.stringify(result))
    })
    return result
  }
  const initialSheet = await player.query(api.characters.sheet.get, { id: characterId })
  assert.ok(initialSheet)
  const preparedSheet = await player.mutation(api.characters.sheetCommands.execute, {
    id: characterId,
    command: {
      type: 'SET_HIT_POINTS',
      commandId: crypto.randomUUID(),
      expectedVersion: initialSheet.meta.streamVersion,
      current: 12,
      maxOverride: 15
    }
  })
  // Manual initiative: the GM rolls the Character's and sets the opponent's before START.
  const {
    version: playSettingsVersion,
    updatedAt: _updatedAt,
    ...playSettings
  } = await owner.query(api.campaigns.playSettings.get, { campaignId })
  await owner.mutation(api.campaigns.playSettings.save, {
    ...playSettings,
    expectedVersion: playSettingsVersion,
    automationMode: 'MANUAL',
    manualReminderMode: 'OFF',
    initiativePolicyDefinitionId: null,
    initiativeTieDefinitionId: null
  })
  const blueprint = await owner.mutation(api.encounters.blueprints.create, {
    gameSystemId: srdSystemRecord.id,
    name: 'Encounter execution fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Practice opponent', maxHitPoints: 10 }]
  })
  const run = await measure('createRun', () =>
    owner.mutation(api.encounters.runs.create, {
      campaignId,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
  )
  const actor = run.actors.find(
    (entry) => entry.kind === 'CHARACTER' && entry.sourceId === characterId
  )
  assert.ok(actor)
  assert.equal(run.actors.length, 2)
  const characterCommand = {
    type: 'ADJUST_HIT_POINTS',
    commandId: crypto.randomUUID(),
    expectedVersion: preparedSheet.streamVersion,
    mode: 'DAMAGE',
    amount: 3
  } as const
  // A prepared Run holds no play: its GM edits the Character from the Sheet.
  await assert.rejects(
    owner.mutation(executeEncounterCommand, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version,
        actorId: actor.id,
        characterCommand
      }
    }),
    /Make this change from the Character Sheet\./
  )
  const initiative: EncounterExecuteInput = {
    command: {
      type: 'ROLL_ACTOR_INITIATIVE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      actorId: actor.id
    }
  }
  const rolled = await measure('characterInitiative', () =>
    owner.mutation(executeEncounterCommand, initiative)
  )
  assert.equal(rolled.roll?.characterId, characterId)
  assert.equal(rolled.roll.source.kind, 'INITIATIVE')
  assert.ok(
    Number.isFinite(rolled.projection.actors.find((entry) => entry.id === actor.id)?.initiative)
  )
  assert.deepEqual(
    await measure('initiativeReplay', () => owner.mutation(executeEncounterCommand, initiative)),
    rolled
  )
  await checkpoint?.()
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: run.id }),
    rolled.projection
  )
  const opponent = run.actors.find((entry) => entry.kind === 'CUSTOM')
  assert.ok(opponent)
  const ordered = await owner.mutation(executeEncounterCommand, {
    command: {
      type: 'SET_INITIATIVE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: rolled.projection.version,
      actorId: opponent.id,
      initiative: 0,
      manualOrder: 1
    }
  })
  const started = await owner.mutation(executeEncounterCommand, {
    command: {
      type: 'START',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: ordered.projection.version
    }
  })
  assert.equal(started.projection.status, 'ACTIVE')
  const damage: EncounterExecuteInput = {
    command: {
      type: 'UPDATE_ACTOR',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: started.projection.version,
      actorId: actor.id,
      characterCommand
    }
  }
  await assert.rejects(anonymous.mutation(executeEncounterCommand, damage), /Unauthenticated/)
  // A player's GM command is refused as the GM's, not as a changed Encounter (D42).
  await assert.rejects(player.mutation(executeEncounterCommand, damage), /GM_ONLY/)
  const damaged = await measure('nestedCharacterDamage', () =>
    owner.mutation(executeEncounterCommand, damage)
  )
  const damagedActor = encounterGmProjectionDtoSchema
    .parse(damaged.projection)
    .actors.find((entry) => entry.id === actor.id)
  assert.equal(damagedActor?.currentHitPoints, 9)
  assert.equal(damagedActor.maxHitPoints, 15)
  await checkpoint?.()
  const sheet = await player.query(api.characters.sheet.get, { id: characterId })
  assert.ok(sheet)
  assert.equal(sheet.overview.currentHitPoints, 9)
  assert.equal(sheet.meta.streamVersion, preparedSheet.streamVersion + 1)
  assert.deepEqual(
    await measure('nestedDamageReplay', () => owner.mutation(executeEncounterCommand, damage)),
    damaged
  )
  await assert.rejects(
    owner.mutation(executeEncounterCommand, {
      command: { ...damage.command, expectedVersion: damaged.projection.version }
    }),
    /different input/
  )
  await assert.rejects(
    owner.mutation(executeEncounterCommand, {
      command: { ...damage.command, commandId: crypto.randomUUID() }
    }),
    /version|stale/i
  )
  assert.deepEqual(await player.query(api.characters.sheet.get, { id: characterId }), sheet)
  console.log(
    JSON.stringify({
      proof: 'one-Character Encounter execution diagnostic',
      campaignId,
      encounterId: run.id,
      characterId,
      nestedDamage: 'PASS',
      exactReplay: 'PASS',
      mismatchedReplay: 'PASS',
      staleVersion: 'PASS',
      anonymousAndPlayerCommandDenial: 'PASS',
      characterInitiative: 'PASS',
      measurements
    })
  )
}
